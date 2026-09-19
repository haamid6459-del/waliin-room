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

  for (const client of room) {
    if (client !== except) {
      send(client, data);
    }
  }
}

wss.on("connection", (ws) => {

  ws.id = Math.random().toString(36).substring(2);
  ws.name = "Guest";

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

    if (msg.type === "join") {

      const roomName =
        String(msg.room || "waliin-room")
        .substring(0, 80);

      ws.room = roomName;

      if (!rooms.has(roomName)) {
        rooms.set(roomName, new Set());
      }

      const room = rooms.get(roomName);

      const members = [...room].map(user => ({
        id: user.id,
        name: user.name
      }));

      room.add(ws);

      send(ws, {
        type: "joined",
        id: ws.id,
        room: roomName,
        members
      });

      broadcast(
        roomName,
        {
          type: "user-joined",
          user: {
            id: ws.id,
            name: ws.name
          }
        },
        ws
      );

      return;
    }

    if (!ws.room) return;

    if (
      msg.type === "chat" ||
      msg.type === "offer" ||
      msg.type === "answer" ||
      msg.type === "ice"
    ) {

      const room = rooms.get(ws.room);

      if (!room) return;

      const packet = {
        ...msg,
        from: ws.id,
        name: ws.name
      };

      if (msg.to) {

        for (const client of room) {
          if (client.id === msg.to) {
            send(client, packet);
            break;
          }
        }

      } else {

        broadcast(ws.room, packet, ws);

      }
    }
  });

  ws.on("close", () => {

    if (!ws.room) return;

    const room = rooms.get(ws.room);

    if (!room) return;

    room.delete(ws);

    broadcast(ws.room, {
      type: "user-left",
      id: ws.id
    });

    if (room.size === 0) {
      rooms.delete(ws.room);
    }
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Waliin Room running on port ${PORT}`);
});
