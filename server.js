import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 10000;

const wss = new WebSocketServer({ port: PORT });

const rooms = {}; // roomName -> { clients: [{ws, username}], hostWs, djs:Set(ws) }

wss.on("connection", (ws) => {
  let currentRoom = null;
  let username = null;

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    // JOIN
    if (data.type === "join") {
      currentRoom = data.room;
      username = data.username;

      if (!rooms[currentRoom]) {
        rooms[currentRoom] = {
          clients: [],
          hostWs: null,
          djs: new Set(),
          state: null
        };
      }

      const roomObj = rooms[currentRoom];
      roomObj.clients.push({ ws, username });

      // ilk giren host
      if (!roomObj.hostWs) roomObj.hostWs = ws;

      broadcastRoomData(currentRoom);
      return;
    }

    // DJ yetkisi değişikliği (ileride eklenecek)
    if (data.type === "setDj" && currentRoom && rooms[currentRoom]) {
      const roomObj = rooms[currentRoom];
      if (ws !== roomObj.hostWs) return; // sadece host

      const targetName = data.username;
      const target = roomObj.clients.find(c => c.username === targetName);
      if (!target) return;

      if (data.enabled) roomObj.djs.add(target.ws);
      else roomObj.djs.delete(target.ws);

      broadcastRoomData(currentRoom);
      return;
    }

    // (Sync update mesajlarını sonra ekleyeceğiz)
  });

  ws.on("close", () => {
    // kullanıcıyı odalardan temizle
    for (const roomName of Object.keys(rooms)) {
      const roomObj = rooms[roomName];

      roomObj.clients = roomObj.clients.filter(c => c.ws !== ws);
      roomObj.djs.delete(ws);

      // host çıktıysa yeni host seç
      if (roomObj.hostWs === ws) {
        roomObj.hostWs = roomObj.clients[0]?.ws || null;
      }

      // oda boşsa sil
      if (roomObj.clients.length === 0) {
        delete rooms[roomName];
      } else {
        broadcastRoomData(roomName);
      }
    }
  });
});

function broadcastRoomData(roomName) {
  const roomObj = rooms[roomName];
  if (!roomObj) return;

  const users = roomObj.clients.map(c => ({
    username: c.username,
    isHost: c.ws === roomObj.hostWs,
    isDj: roomObj.djs.has(c.ws)
  }));

  const payload = JSON.stringify({
    type: "roomData",
    users
  });

  roomObj.clients.forEach(c => c.ws.send(payload));
}

console.log("BozoJam server running on port", PORT);
