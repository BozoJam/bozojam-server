const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 10000 });

const rooms = {};

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);

    if (data.type === "join") {
      const { room, username } = data;

      if (!rooms[room]) {
        rooms[room] = [];
      }

      const isHost = rooms[room].length === 0;

      const user = { username, isHost, ws };
      rooms[room].push(user);

      broadcastRoom(room);
    }
  });

  ws.on("close", () => {
    for (const room in rooms) {
      rooms[room] = rooms[room].filter(user => user.ws !== ws);
      broadcastRoom(room);
    }
  });
});

function broadcastRoom(room) {
  if (!rooms[room]) return;

  const users = rooms[room].map(user => ({
    username: user.username,
    isHost: user.isHost
  }));

  const payload = JSON.stringify({
    type: "roomData",
    users
  });

  rooms[room].forEach(user => {
    user.ws.send(payload);
  });
}
