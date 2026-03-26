import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  type RoomJoinPayload,
  type DiceRollPayload,
  type ScoreSelectPayload,
  type GameEndPayload,
  type RoomSettings,
  type LobbyUpdatePayload,
  ALL_CATEGORIES,
  DEFAULT_MAX_PLAYERS,
} from '@yacht-dice/shared';
import { GameRoom } from '../game/GameRoom.js';
import { calculatePossibleScores } from '../game/ScoreCalculator.js';

export function registerHandlers(
  io: Server,
  socket: Socket,
  rooms: Map<string, GameRoom>,
) {
  // Helper: broadcast game state to all in room
  function broadcastState(room: GameRoom) {
    io.to(room.getRoomId()).emit('game:state', { gameState: room.getState() });
  }

  function emitError(msg: string) {
    socket.emit('error', { message: msg });
  }

  // Helper: broadcast room list to lobby subscribers
  function broadcastRoomList() {
    const roomList = [];
    for (const room of rooms.values()) {
      if (room.getPhase() === 'waiting') {
        roomList.push(room.getRoomListItem());
      }
    }
    io.to('lobby').emit('roomList:update', { rooms: roomList });
  }

  // Helper: broadcast lobby update to room members
  function broadcastLobbyUpdate(room: GameRoom) {
    const state = room.getState();
    const payload: LobbyUpdatePayload = {
      players: state.players.map(p => ({ id: p.id, nickname: p.nickname })),
      maxPlayers: state.maxPlayers,
      hostPlayerId: state.hostPlayerId,
    };
    io.to(room.getRoomId()).emit('lobby:update', payload);
  }

  // Helper: set up a timeout for a room's current turn
  function setupTurnTimeout(room: GameRoom) {
    room.startInitialTimer(() => {
      // Auto-select on timeout
      const bestCat = room.handleTimeout();
      if (!bestCat) return;

      const currentPlayer = room.getCurrentPlayer();

      try {
        const result = room.selectScore(
          currentPlayer.id,
          bestCat,
          () => setupTurnTimeout(room),
        );

        broadcastState(room);

        if (result.isGameOver) {
          const state = room.getState();
          const payload: GameEndPayload = {
            winner: state.winner,
            rankings: room.getRankings(),
          };
          io.to(room.getRoomId()).emit('game:end', payload);
        } else {
          const nextPlayer = room.getCurrentPlayer();
          io.to(room.getRoomId()).emit('turn:start', {
            playerId: nextPlayer.id,
            rollsLeft: room.getState().dice.rollsLeft,
            timer: 30,
            currentRound: room.getState().currentRound,
          });
        }
      } catch {
        // ignore errors in auto-score
      }
    });
  }

  // room:create
  socket.on('room:create', (payload: { nickname: string; playerId?: string; roomSettings?: RoomSettings }) => {
    const { nickname, playerId, roomSettings } = payload;

    if (!nickname?.trim()) {
      return emitError('Nickname is required');
    }

    const newRoomId = uuidv4().slice(0, 8).toUpperCase();
    const newPlayerId = playerId || uuidv4();
    const settings = {
      roomName: roomSettings?.roomName || `${nickname}의 방`,
      maxPlayers: roomSettings?.maxPlayers || DEFAULT_MAX_PLAYERS,
    };
    const room = new GameRoom(newRoomId, { id: newPlayerId, socketId: socket.id, nickname }, settings);
    rooms.set(newRoomId, room);

    socket.join(newRoomId);
    socket.emit('room:created', {
      roomId: newRoomId,
      playerId: newPlayerId,
      roomName: settings.roomName,
      maxPlayers: settings.maxPlayers,
    });

    broadcastRoomList();
  });

  // room:join
  socket.on('room:join', (payload: RoomJoinPayload) => {
    const { nickname, roomId, playerId } = payload;

    if (!nickname?.trim()) {
      return emitError('Nickname is required');
    }

    // Reconnect path
    if (playerId && roomId) {
      const room = rooms.get(roomId);
      if (room) {
        try {
          room.reconnect(playerId, socket.id);
          socket.join(roomId);
          socket.to(roomId).emit('player:reconnected', { playerId });
          broadcastState(room);
          return;
        } catch {
          // fall through to join as new
        }
      }
    }

    // Join existing room
    if (roomId) {
      const room = rooms.get(roomId);
      if (!room) {
        return emitError('Room not found');
      }
      const state = room.getState();
      if (state.phase !== 'waiting') {
        return emitError('Game already started');
      }
      if (state.players.length >= state.maxPlayers) {
        return emitError('Room is full');
      }

      const newPlayerId = uuidv4();
      try {
        room.join({ id: newPlayerId, socketId: socket.id, nickname });
      } catch (e: unknown) {
        return emitError(e instanceof Error ? e.message : 'Failed to join');
      }

      socket.join(roomId);

      const newState = room.getState();
      socket.emit('room:joined', {
        roomId,
        playerId: newPlayerId,
        roomName: newState.roomName,
        maxPlayers: newState.maxPlayers,
        players: newState.players.map(p => ({ id: p.id, nickname: p.nickname })),
      });

      // Broadcast lobby update to all room members
      broadcastLobbyUpdate(room);
      broadcastRoomList();
      return;
    }

    // Legacy: create room if no roomId (backward compat)
    const newRoomId = uuidv4().slice(0, 8).toUpperCase();
    const newPlayerId2 = uuidv4();
    const settings = { roomName: `${nickname}의 방`, maxPlayers: DEFAULT_MAX_PLAYERS };
    const room = new GameRoom(newRoomId, { id: newPlayerId2, socketId: socket.id, nickname }, settings);
    rooms.set(newRoomId, room);

    socket.join(newRoomId);
    socket.emit('room:created', { roomId: newRoomId, playerId: newPlayerId2, roomName: settings.roomName, maxPlayers: settings.maxPlayers });
    broadcastRoomList();
  });

  // room:start — host starts the game
  socket.on('room:start', (payload: { roomId: string }) => {
    const { roomId } = payload;
    const room = rooms.get(roomId);
    if (!room) return emitError('Room not found');

    // Only the host can start
    const player = findPlayerBySocket(room, socket.id);
    if (!player || player.id !== room.getHostId()) {
      return emitError('Only the host can start the game');
    }

    if (!room.canStart()) {
      return emitError('Need at least 2 players to start');
    }

    try {
      room.startGame();
    } catch (e: unknown) {
      return emitError(e instanceof Error ? e.message : 'Failed to start');
    }

    broadcastState(room);

    const currentPlayer = room.getCurrentPlayer();
    io.to(roomId).emit('turn:start', {
      playerId: currentPlayer.id,
      rollsLeft: room.getState().dice.rollsLeft,
      timer: 30,
      currentRound: room.getState().currentRound,
    });

    setupTurnTimeout(room);
    broadcastRoomList();
  });

  // room:leave — leave waiting room
  socket.on('room:leave', (payload: { roomId: string }) => {
    const { roomId } = payload;
    const room = rooms.get(roomId);
    if (!room) return;

    const player = findPlayerBySocket(room, socket.id);
    if (!player) return;

    const removed = room.removePlayer(player.id);
    if (removed) {
      socket.leave(roomId);
      const state = room.getState();
      if (state.players.length === 0) {
        rooms.delete(roomId);
      } else {
        broadcastLobbyUpdate(room);
      }
      broadcastRoomList();
    }
  });

  // roomList:subscribe
  socket.on('roomList:subscribe', () => {
    socket.join('lobby');
    // Send current room list immediately
    const roomList = [];
    for (const room of rooms.values()) {
      if (room.getPhase() === 'waiting') {
        roomList.push(room.getRoomListItem());
      }
    }
    socket.emit('roomList:update', { rooms: roomList });
  });

  // roomList:unsubscribe
  socket.on('roomList:unsubscribe', () => {
    socket.leave('lobby');
  });

  // dice:roll
  socket.on('dice:roll', (payload: DiceRollPayload) => {
    const { heldDiceIndices } = payload;

    // Find the room this socket is in
    const room = findRoomBySocket(rooms, socket.id);
    if (!room) return emitError('Not in a room');

    const player = findPlayerBySocket(room, socket.id);
    if (!player) return emitError('Player not found');

    try {
      const diceState = room.roll(player.id, heldDiceIndices ?? [], () => setupTurnTimeout(room));
      broadcastState(room);
      socket.emit('dice:result', {
        dice: diceState.values,
        rollsLeft: diceState.rollsLeft,
      });
    } catch (e: unknown) {
      emitError(e instanceof Error ? e.message : 'Roll failed');
    }
  });

  // score:select
  socket.on('score:select', (payload: ScoreSelectPayload) => {
    const { category } = payload;

    const room = findRoomBySocket(rooms, socket.id);
    if (!room) return emitError('Not in a room');

    const player = findPlayerBySocket(room, socket.id);
    if (!player) return emitError('Player not found');

    try {
      const result = room.selectScore(
        player.id,
        category,
        () => setupTurnTimeout(room),
      );

      broadcastState(room);

      // Score update for this player
      const updatedPlayer = room.getPlayerById(player.id)!;
      io.to(room.getRoomId()).emit('score:update', {
        playerId: player.id,
        category,
        score: updatedPlayer.scorecard[category]!,
        scorecard: updatedPlayer.scorecard,
        upperTotal: updatedPlayer.upperTotal,
        upperBonus: updatedPlayer.upperBonus,
        totalScore: updatedPlayer.totalScore,
      });

      if (result.isGameOver) {
        const state = room.getState();
        const endPayload: GameEndPayload = {
          winner: state.winner,
          rankings: room.getRankings(),
        };
        io.to(room.getRoomId()).emit('game:end', endPayload);
      } else {
        const state = room.getState();
        const nextPlayer = room.getCurrentPlayer();
        io.to(room.getRoomId()).emit('turn:start', {
          playerId: nextPlayer.id,
          rollsLeft: state.dice.rollsLeft,
          timer: 30,
          currentRound: state.currentRound,
        });
      }
    } catch (e: unknown) {
      emitError(e instanceof Error ? e.message : 'Score select failed');
    }
  });

  // player:reconnect
  socket.on('player:reconnect', (payload: { roomId: string; playerId: string }) => {
    const { roomId, playerId } = payload;
    const room = rooms.get(roomId);
    if (!room) return emitError('Room not found');

    try {
      room.reconnect(playerId, socket.id);
      socket.join(roomId);

      // Notify the room
      socket.to(roomId).emit('player:reconnected', { playerId });

      // Send full state to reconnected player
      broadcastState(room);
    } catch (e: unknown) {
      emitError(e instanceof Error ? e.message : 'Reconnect failed');
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    for (const room of rooms.values()) {
      const player = findPlayerBySocket(room, socket.id);
      if (player) {
        // If in waiting phase, remove player entirely
        if (room.getPhase() === 'waiting') {
          room.removePlayer(player.id);
          const state = room.getState();
          if (state.players.length === 0) {
            rooms.delete(room.getRoomId());
          } else {
            broadcastLobbyUpdate(room);
          }
          broadcastRoomList();
        } else {
          room.disconnect(player.id);
          io.to(room.getRoomId()).emit('player:disconnected', { playerId: player.id });
        }
        break;
      }
    }
  });
}

function findRoomBySocket(rooms: Map<string, GameRoom>, socketId: string): GameRoom | undefined {
  for (const room of rooms.values()) {
    const state = room.getState();
    for (const p of state.players) {
      if (p?.socketId === socketId) return room;
    }
  }
  return undefined;
}

function findPlayerBySocket(room: GameRoom, socketId: string) {
  const state = room.getState();
  for (const p of state.players) {
    if (p?.socketId === socketId) return p;
  }
  return undefined;
}
