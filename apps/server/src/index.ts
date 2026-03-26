import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameRoom } from './game/GameRoom.js';
import { registerHandlers } from './events/handlers.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Room registry
const rooms = new Map<string, GameRoom>();

// GC: track when all players in a room have disconnected
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

function broadcastRoomList() {
  const roomList = [];
  for (const room of rooms.values()) {
    if (room.getPhase() === 'waiting') {
      roomList.push(room.getRoomListItem());
    }
  }
  io.to('lobby').emit('roomList:update', { rooms: roomList });
}

function scheduleRoomCleanup(roomId: string) {
  // Cancel any existing timer for this room
  const existing = disconnectTimers.get(roomId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    const room = rooms.get(roomId);
    if (room && room.areAllDisconnected()) {
      rooms.delete(roomId);
      disconnectTimers.delete(roomId);
      console.log(`[GC] Room ${roomId} cleaned up`);
      broadcastRoomList();
    }
  }, 60_000);

  disconnectTimers.set(roomId, timer);
}

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  registerHandlers(io, socket, rooms);

  // When a socket disconnects, check if we should schedule room GC
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    for (const [roomId, room] of rooms) {
      const state = room.getState();
      const isInRoom = state.players.some(p => p?.socketId === socket.id);
      if (isInRoom && room.areAllDisconnected()) {
        scheduleRoomCleanup(roomId);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Yacht Dice server listening on port ${PORT}`);
});
