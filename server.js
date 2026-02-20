import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 3000;

const wss = new WebSocketServer({ port: PORT });

const rooms = {};

wss.on("connection", (ws) => {
  let currentRoom = null;
  let username = null;

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    // Odaya katılma
    if (data.type === "join") {
      currentRoom = data.room;
      username = data.username;

      if (!rooms[currentRoom]) {
        rooms[currentRoom] = {
          clients: [],
          state: null
        };
      }

      rooms[currentRoom].clients.push({ ws, username });

      broadcastRoomInfo(currentRoom);

      // Yeni gelen varsa mevcut state'i yolla
      if (rooms[currentRoom].state) {
        ws.send(JSON.stringify({
          type: "sync",
          state: rooms[currentRoom].state
        }));
      }

      return;
    }

    if (!rooms[currentRoom]) return;

    // State güncelleme
    if (data.type === "update") {
      rooms[currentRoom].state = data.state;

      rooms[currentRoom].clients.forEach(client => {
        if (client.ws !== ws) {
          client.ws.send(JSON.stringify({
            type: "sync",
            state: data.state
          }));
        }
      });
    }
  });

  ws.on("close", () => {
    if (!currentRoom || !rooms[currentRoom]) return;

    rooms[currentRoom].clients =
      rooms[currentRoom].clients.filter(c => c.ws !== ws);

    broadcastRoomInfo(currentRoom);
  });
});

function broadcastRoomInfo(room) {
  const roomData = rooms[room];
  const count = roomData.clients.length;

  roomData.clients.forEach(client => {
    client.ws.send(JSON.stringify({
      type: "roomInfo",
      userCount: count
    }));
  });
}

console.log("BozoJam server running on port", PORT);
