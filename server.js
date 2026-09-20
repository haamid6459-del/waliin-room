const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ===============================
// SETTINGS
// ===============================

const settings = {
  maxUsersPerRoom: 10,
  maxRooms: 100,
  allowVideo: true,
  allowAudio: true,
  allowChat: true,
  allowScreenShare: true,
  allowRoomCreation: true
};

// ===============================
// ROOMS
// ===============================

const rooms = new Map();

/*
rooms = {
  roomId: {
    name: "...",
    owner: socketId,
    users: Map()
  }
}
*/

// ===============================
// BASIC ROUTES
// ===============================

app.get("/", (req, res) => {
  res.json({
    success: true,
    app: "Waliin Room Server",
    status: "online",
    version: "1.0.0"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    rooms: rooms.size,
    maxUsersPerRoom: settings.maxUsersPerRoom
  });
});

// ===============================
// SETTINGS API
// ===============================

app.get("/api/settings", (req, res) => {
  res.json({
    success: true,
    settings
  });
});

// ===============================
// ROOM LIST
// ===============================

app.get("/api/rooms", (req, res) => {
  const roomList = [];

  for (const [roomId, room] of rooms.entries()) {
    roomList.push({
      roomId,
      name: room.name,
      users: room.users.size,
      maxUsers: settings.maxUsersPerRoom,
      available:
        room.users.size < settings.maxUsersPerRoom
    });
  }

  res.json({
    success: true,
    rooms: roomList
  });
});

// ===============================
// SOCKET CONNECTION
// ===============================

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // -------------------------------
  // CREATE ROOM
  // -------------------------------

  socket.on("create-room", ({ roomId, roomName, username }, callback) => {
    if (!settings.allowRoomCreation) {
      return callback({
        success: false,
        message: "Room creation is disabled."
      });
    }

    if (rooms.size >= settings.maxRooms) {
      return callback({
        success: false,
        message: "Maximum number of rooms reached."
      });
    }

    if (!roomId) {
      return callback({
        success: false,
        message: "Room ID is required."
      });
    }

    if (rooms.has(roomId)) {
      return callback({
        success: false,
        message: "Room already exists."
      });
    }

    const room = {
      name: roomName || roomId,
      owner: socket.id,
      users: new Map()
    };

    room.users.set(socket.id, {
      socketId: socket.id,
      username: username || "User",
      joinedAt: new Date().toISOString()
    });

    rooms.set(roomId, room);

    socket.join(roomId);
    socket.currentRoom = roomId;
    socket.username = username || "User";

    callback({
      success: true,
      roomId,
      roomName: room.name
    });

    io.to(roomId).emit("room-users", getUsers(room));
  });

  // -------------------------------
  // JOIN ROOM
  // -------------------------------

  socket.on("join-room", ({ roomId, username }, callback) => {
    const room = rooms.get(roomId);

    if (!room) {
      return callback({
        success: false,
        message: "Room not found."
      });
    }

    if (room.users.size >= settings.maxUsersPerRoom) {
      return callback({
        success: false,
        message: "Room is full. Maximum 10 users allowed."
      });
    }

    room.users.set(socket.id, {
      socketId: socket.id,
      username: username || "User",
      joinedAt: new Date().toISOString()
    });

    socket.join(roomId);
    socket.currentRoom = roomId;
    socket.username = username || "User";

    socket.to(roomId).emit("user-joined", {
      socketId: socket.id,
      username: socket.username
    });

    callback({
      success: true,
      roomId,
      roomName: room.name,
      users: getUsers(room)
    });

    io.to(roomId).emit("room-users", getUsers(room));
  });

  // -------------------------------
  // CHAT MESSAGE
  // -------------------------------

  socket.on("chat-message", ({ message }) => {
    const roomId = socket.currentRoom;

    if (!roomId || !settings.allowChat) return;

    io.to(roomId).emit("chat-message", {
      socketId: socket.id,
      username: socket.username || "User",
      message,
      time: new Date().toISOString()
    });
  });

  // -------------------------------
  // WEBRTC OFFER
  // -------------------------------

  socket.on("offer", ({ target, offer }) => {
    io.to(target).emit("offer", {
      sender: socket.id,
      offer
    });
  });

  // -------------------------------
  // WEBRTC ANSWER
  // -------------------------------

  socket.on("answer", ({ target, answer }) => {
    io.to(target).emit("answer", {
      sender: socket.id,
      answer
    });
  });

  // -------------------------------
  // ICE CANDIDATE
  // -------------------------------

  socket.on("ice-candidate", ({ target, candidate }) => {
    io.to(target).emit("ice-candidate", {
      sender: socket.id,
      candidate
    });
  });

  // -------------------------------
  // MUTE / UNMUTE
  // -------------------------------

  socket.on("toggle-audio", ({ enabled }) => {
    if (!settings.allowAudio) return;

    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit("user-audio-changed", {
        socketId: socket.id,
        enabled
      });
    }
  });

  // -------------------------------
  // VIDEO ON/OFF
  // -------------------------------

  socket.on("toggle-video", ({ enabled }) => {
    if (!settings.allowVideo) return;

    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit("user-video-changed", {
        socketId: socket.id,
        enabled
      });
    }
  });

  // -------------------------------
  // SCREEN SHARE
  // -------------------------------

  socket.on("screen-share", ({ enabled }) => {
    if (!settings.allowScreenShare) return;

    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit("screen-share-changed", {
        socketId: socket.id,
        enabled
      });
    }
  });

  // -------------------------------
  // REMOVE USER
  // -------------------------------

  socket.on("remove-user", ({ targetSocketId }, callback) => {
    const roomId = socket.currentRoom;
    const room = rooms.get(roomId);

    if (!room) {
      return callback?.({
        success: false,
        message: "Room not found."
      });
    }

    if (room.owner !== socket.id) {
      return callback?.({
        success: false,
        message: "Only the room owner can remove users."
      });
    }

    if (!room.users.has(targetSocketId)) {
      return callback?.({
        success: false,
        message: "User not found."
      });
    }

    const targetSocket = io.sockets.sockets.get(targetSocketId);

    room.users.delete(targetSocketId);

    if (targetSocket) {
      targetSocket.leave(roomId);
      targetSocket.currentRoom = null;

      targetSocket.emit("removed-from-room", {
        message: "You were removed from the room."
      });
    }

    io.to(roomId).emit("room-users", getUsers(room));

    callback?.({
      success: true
    });
  });

  // -------------------------------
  // LEAVE ROOM
  // -------------------------------

  socket.on("leave-room", () => {
    leaveRoom(socket);
  });

  // -------------------------------
  // DISCONNECT
  // -------------------------------

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    leaveRoom(socket);
  });
});

// ===============================
// GET USERS
// ===============================

function getUsers(room) {
  return Array.from(room.users.values());
}

// ===============================
// LEAVE ROOM FUNCTION
// ===============================

function leaveRoom(socket) {
  const roomId = socket.currentRoom;

  if (!roomId) return;

  const room = rooms.get(roomId);

  if (!room) return;

  const wasOwner = room.owner === socket.id;

  room.users.delete(socket.id);

  socket.leave(roomId);
  socket.currentRoom = null;

  socket.to(roomId).emit("user-left", {
    socketId: socket.id,
    username: socket.username || "User"
  });

  // If owner leaves, give ownership to another user
  if (wasOwner && room.users.size > 0) {
    const newOwner = room.users.keys().next().value;

    room.owner = newOwner;

    io.to(newOwner).emit("room-owner", {
      message: "You are now the room owner."
    });
  }

  // Delete empty room
  if (room.users.size === 0) {
    rooms.delete(roomId);
  } else {
    io.to(roomId).emit("room-users", getUsers(room));
  }
}

// ===============================
// SERVER
// ===============================

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Waliin Room Server running on port ${PORT}`);
});
