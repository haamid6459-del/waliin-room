const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    app: "Waliin Room"
  });
});

const rooms = new Map();

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(roomName, data, except = null) {
  const room = rooms.get(roomName);
  if (!room) return;

  for (const client of room.members) {
    if (client !== except) {
      send(client, data);
    }
  }
}

function leaveRoom(ws) {
  if (!ws.room) return;

  const room = rooms.get(ws.room);

  if (!room) {
    ws.room = null;
    return;
  }

  room.members.delete(ws);

  broadcast(ws.room, {
    type: "user-left",
    id: ws.id,
    name: ws.name
  });

  if (room.members.size === 0) {
    rooms.delete(ws.room);
  }

  ws.room = null;
}

function joinRoom(ws, roomData) {
  if (ws.room) {
    leaveRoom(ws);
  }

  ws.room = roomData.name;
  roomData.members.add(ws);

  const members = [...roomData.members].map(user => ({
    id: user.id,
    name: user.name,
    owner: user.id === roomData.owner
  }));

  send(ws, {
    type: "joined",
    id: ws.id,
    room: roomData.name,
    owner: roomData.owner,
    members
  });

  broadcast(
    roomData.name,
    {
      type: "user-joined",
      user: {
        id: ws.id,
        name: ws.name,
        owner: ws.id === roomData.owner
      }
    },
    ws
  );
}

wss.on("connection", ws => {

  ws.id = Math.random()
    .toString(36)
    .substring(2);

  ws.name = "Guest";
  ws.room = null;

  ws.on("message", raw => {

    let msg;

    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    // NAME
    if (msg.type === "set-name") {

      ws.name =
        String(msg.name || "Guest")
        .substring(0, 40);

      return;
    }

    // CREATE ROOM
    if (msg.type === "create-room") {

      const roomName =
        String(msg.room || "")
        .trim()
        .substring(0, 50);

      const password =
        String(msg.password || "");

      if (!roomName) {

        send(ws, {
          type: "error",
          message: "Maqaa Room galchi."
        });

        return;
      }

      if (rooms.has(roomName)) {

        send(ws, {
          type: "error",
          message: "Room kun duraan jira."
        });

        return;
      }

      const roomData = {
        name: roomName,
        password,
        owner: ws.id,
        members: new Set()
      };

      rooms.set(roomName, roomData);

      joinRoom(ws, roomData);

      return;
    }

    // JOIN ROOM
    if (msg.type === "join") {

      const roomName =
        String(msg.room || "")
        .trim()
        .substring(0, 50);

      const roomData =
        rooms.get(roomName);

      if (!roomData) {

        send(ws, {
          type: "error",
          message: "Room hin argamne."
        });

        return;
      }

      if (
        roomData.password &&
        roomData.password !==
        String(msg.password || "")
      ) {

        send(ws, {
          type: "error",
          message: "Password sirrii miti."
        });

        return;
      }

      joinRoom(ws, roomData);

      return;
    }

    if (!ws.room) return;

    // CHAT
    if (msg.type === "chat") {

      broadcast(
        ws.room,
        {
          type: "chat",
          from: ws.id,
          name: ws.name,
          message:
            String(msg.message || "")
            .substring(0, 1000)
        },
        ws
      );

      return;
    }

    // WEBRTC SIGNALING
    if (
      msg.type === "offer" ||
      msg.type === "answer" ||
      msg.type === "ice"
    ) {

      const room =
        rooms.get(ws.room);

      if (!room) return;

      for (const client of room.members) {

        if (client.id === msg.to) {

          send(client, {
            ...msg,
            from: ws.id,
            name: ws.name
          });

          break;
        }
      }

      return;
    }
  });

  ws.on("close", () => {
    leaveRoom(ws);
  });
});

const PORT =
  process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(
    `Waliin Room running on port ${PORT}`
  );
});  
