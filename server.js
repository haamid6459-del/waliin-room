const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({ ok: true, app: "Waliin Room" });
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
    if (client !== except) send(client, data);
  }
}

wss.on("connection", (ws) => {
  ws.id = Math.random().toString(36).substring(2);
  ws.name = "Guest";
  ws.room = null;

  ws.on("message", (raw) => {
    let msg;

    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "set-name") {
      ws.name = String(msg.name || "Guest").substring(0, 40);
      return;
    }

    if (msg.type === "create-room") {
      const name = String(msg.room || "").trim().substring(0, 50);
      const password = String(msg.password || "");

      if (!name) {
        return send(ws, {
          type: "error",
          message: "Maqaan Room barbaachisaa dha."
        });
      }

      if (rooms.has(name)) {
        return send(ws, {
          type: "error",
          message: "Room kun duraan jira."
        });
      }

      const roomData = {
        name,
        password,
        owner: ws.id,
        members: new Set()
      };

      rooms.set(name, roomData);

      joinRoom(ws, roomData);
      return;
    }

    if (msg.type === "join") {
      const roomName =
        String(msg.room || "waliin-room")
          .trim()
          .substring(0, 50);

      const roomData = rooms.get(roomName);

      if (!roomData) {
        return send(ws, {
          type: "error",
          message: "Room hin argamne."
        });
      }

      if (
        roomData.password &&
        roomData.password !== String(msg.password || "")
      ) {
        return send(ws, {
          type: "error",
          message: "Password Room sirrii miti."
        });
      }

      joinRoom(ws, roomData);
      return;
    }

    if (!ws.room) return;

    if (msg.type === "chat") {
      broadcast(ws.room, {
        type: "chat",
        from: ws.id,
        name: ws.name,
        message: String(msg.message || "").substring(0, 1000)
      }, ws);
      return;
    }

    if (
      msg.type === "offer" ||
      msg.type === "answer" ||
      msg.type === "ice"
    ) {
      const roomData = rooms.get(ws.room);
      if (!roomData) return;

      for (const client of roomData.members) {
        if (client.id === msg.to) {
          send(client, {
            ...msg,
            from: ws.id,
            name: ws.name
          });
          break;
        }
      }
    }
  });

  ws.on("close", () => {
    leaveRoom(ws);
  });
});

function joinRoom(ws, roomData) {
  if (ws.room) leaveRoom(ws);

  ws.room = roomData.name;
  roomData.members.add(ws);

  const memberList = [...roomData.members].map(user => ({
    id: user.id,
    name: user.name,
    owner: user.id === roomData.owner
  }));

  send(ws, {
    type: "joined",
    id: ws.id,
    room: roomData.name,
    owner: roomData.owner,
    members: memberList
  });

  broadcast(roomData.name, {
    type: "user-joined",
    user: {
      id: ws.id,
      name: ws.name,
      owner: ws.id === roomData.owner
    }
  }, ws);
}

function leaveRoom(ws) {
  if (!ws.room) return;

  const roomData = rooms.get(ws.room);
  if (!roomData) {
    ws.room = null;
    return;
  }

  roomData.members.delete(ws);

  broadcast(ws.room, {
    type: "user-left",
    id: ws.id,
    name: ws.name
  });

  if (roomData.members.size === 0) {
    rooms.delete(ws.room);
  }

  ws.room = null;
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Waliin Room running on port ${PORT}`);
});
