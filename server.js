import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 10000;
const wss = new WebSocketServer({ port: PORT });

const rooms = {}; 
// roomName -> { clients: [{ws, username}], hostWs, djs:Set(ws), state:{url,time,paused} }

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);

    // JOIN
    if (data.type === "join") {
      const { room, username } = data;

      if (!rooms[room]) {
        rooms[room] = {
          clients: [],
          hostWs: null,
          djs: new Set(),
          state: null
        };
      }

      const roomObj = rooms[room];
      roomObj.clients.push({ ws, username });

      if (!roomObj.hostWs) roomObj.hostWs = ws; // first = host

      // Odayı yayınla
      broadcastRoomData(room);

      // Eğer state varsa yeni gelene gönder
      if (roomObj.state) {
        ws.send(JSON.stringify({ type: "syncState", state: roomObj.state }));
      }

      return;
    }

    // setDj (only host)
    if (data.type === "setDj") {
      const room = findRoomOf(ws);
      if (!room) return;

      const roomObj = rooms[room];
      if (ws !== roomObj.hostWs) return; // only host

      const target = roomObj.clients.find(c => c.username === data.username);
      if (!target) return;

      if (data.enabled) roomObj.djs.add(target.ws);
      else roomObj.djs.delete(target.ws);

      broadcastRoomData(room);
      return;
    }

    // STATE update (only host or DJ)
    if (data.type === "state") {
      const room = findRoomOf(ws);
      if (!room) return;

      const roomObj = rooms[room];
      const isHost = ws === roomObj.hostWs;
      const isDj = roomObj.djs.has(ws);

      if (!isHost && !isDj) return; // not allowed

      // sanitize
      const state = {
        url: String(data.state?.url || ""),
        time: Number(data.state?.time || 0),
        paused: !!data.state?.paused,
        sentAt: Date.now()
      };

      roomObj.state = state;

      // Broadcast everyone (except sender)
      roomObj.clients.forEach(c => {
        if (c.ws !== ws) {
          c.ws.send(JSON.stringify({ type: "syncState", state }));
        }
      });

      return;
    }
  });

  ws.on("close", () => {
    for (const roomName of Object.keys(rooms)) {
      const roomObj = rooms[roomName];

      roomObj.clients = roomObj.clients.filter(c => c.ws !== ws);
      roomObj.djs.delete(ws);

      if (roomObj.hostWs === ws) {
        roomObj.hostWs = roomObj.clients[0]?.ws || null;
      }

      if (roomObj.clients.length === 0) {
        delete rooms[roomName];
      } else {
        broadcastRoomData(roomName);
      }
    }
  });
});

function findRoomOf(ws) {
  for (const roomName of Object.keys(rooms)) {
    const roomObj = rooms[roomName];
    if (roomObj.clients.some(c => c.ws === ws)) return roomName;
  }
  return null;
}

function broadcastRoomData(roomName) {
  const roomObj = rooms[roomName];
  if (!roomObj) return;

  const users = roomObj.clients.map(c => ({
    username: c.username,
    isHost: c.ws === roomObj.hostWs,
    isDj: roomObj.djs.has(c.ws)
  }));

  const payload = JSON.stringify({ type: "roomData", users });
  roomObj.clients.forEach(c => c.ws.send(payload));
}

console.log("BozoJam server running on port", PORT);
