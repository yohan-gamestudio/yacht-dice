import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  type RoomJoinPayload,
  type DiceRollPayload,
  type ScoreSelectPayload,
  type GameEndPayload,
  ALL_CATEGORIES,
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
            players: (state.players.filter(Boolean) as NonNullable<typeof state.players[0]>[]).map(p => ({
              id: p.id,
              nickname: p.nickname,
              totalScore: p.totalScore,
              scorecard: p.scorecard,
              upperBonus: p.upperBonus,
            })),
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
          socket.emit('room:rejoined', { roomId });
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
      if (state.players.filter(Boolean).length >= 2) {
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
        players: newState.players.filter(Boolean).map(p => ({ id: p!.id, nickname: p!.nickname })),
      });

      // Notify host
      socket.to(roomId).emit('room:player_joined', {
        players: newState.players.filter(Boolean).map(p => ({ id: p!.id, nickname: p!.nickname })),
      });

      // Game starts immediately with 2 players
      broadcastState(room);

      const currentPlayer = room.getCurrentPlayer();
      io.to(roomId).emit('turn:start', {
        playerId: currentPlayer.id,
        rollsLeft: newState.dice.rollsLeft,
        timer: 30,
        currentRound: newState.currentRound,
      });

      setupTurnTimeout(room);
      return;
    }

    // Create new room
    const newRoomId = uuidv4().slice(0, 8).toUpperCase();
    const newPlayerId = uuidv4();
    const room = new GameRoom(newRoomId, { id: newPlayerId, socketId: socket.id, nickname });
    rooms.set(newRoomId, room);

    socket.join(newRoomId);
    socket.emit('room:created', { roomId: newRoomId, playerId: newPlayerId });
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
      const diceState = room.roll(player.id, heldDiceIndices ?? []);
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
          players: (state.players.filter(Boolean) as NonNullable<typeof state.players[0]>[]).map(p => ({
            id: p.id,
            nickname: p.nickname,
            totalScore: p.totalScore,
            scorecard: p.scorecard,
            upperBonus: p.upperBonus,
          })),
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
      socket.emit('room:rejoined', { roomId });
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
        room.disconnect(player.id);
        io.to(room.getRoomId()).emit('player:disconnected', { playerId: player.id });
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
