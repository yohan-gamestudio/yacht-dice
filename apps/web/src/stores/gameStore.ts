'use client';

import { create } from 'zustand';
import type {
  GameState,
  ScoreCategory,
  RoomCreatedPayload,
  RoomJoinedPayload,
  TurnStartPayload,
  DiceResultPayload,
  ScoreUpdatePayload,
  GameEndPayload,
  GameStatePayload,
  ErrorPayload,
  RoomListItem,
  RoomSettings,
  LobbyUpdatePayload,
} from '@yacht-dice/shared';
import { getSocket } from '@/lib/socket';
import { calculatePossibleScores } from '@/lib/scoreCalculator';

interface GameStore {
  playerId: string | null;
  nickname: string;
  roomId: string | null;
  gameState: GameState | null;
  phase: 'home' | 'roomList' | 'waiting' | 'playing' | 'finished';
  possibleScores: Record<ScoreCategory, number> | null;
  error: string | null;
  roomList: RoomListItem[];
  lobbyPlayers: { id: string; nickname: string }[];
  isHost: boolean;
  maxPlayers: number;
  roomName: string;
  rankings: GameEndPayload['rankings'] | null;

  setNickname: (name: string) => void;
  createRoom: (settings?: RoomSettings) => void;
  joinRoom: (roomId: string) => void;
  rollDice: (heldIndices: number[]) => void;
  selectScore: (category: ScoreCategory) => void;
  initSocket: () => void;
  resetGame: () => void;
  reconnectToGame: () => boolean;
  subscribeToRoomList: () => void;
  unsubscribeFromRoomList: () => void;
  startGame: () => void;
  leaveRoom: () => void;
}

function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem('playerId');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('playerId', id);
  }
  return id;
}

export const useGameStore = create<GameStore>((set, get) => ({
  playerId: null,
  nickname: '',
  roomId: null,
  gameState: null,
  phase: 'home',
  possibleScores: null,
  error: null,
  roomList: [],
  lobbyPlayers: [],
  isHost: false,
  maxPlayers: 4,
  roomName: '',
  rankings: null,

  setNickname: (name) => set({ nickname: name }),

  createRoom: (settings) => {
    const { nickname } = get();
    const playerId = getOrCreatePlayerId();
    set({ playerId });
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    socket.emit('room:create', {
      nickname,
      playerId,
      roomSettings: settings || { roomName: `${nickname}의 방`, maxPlayers: 4 },
    });
  },

  joinRoom: (roomId) => {
    const { nickname } = get();
    const playerId = getOrCreatePlayerId();
    set({ playerId });
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    socket.emit('room:join', { nickname, roomId, playerId });
  },

  rollDice: (heldIndices) => {
    const socket = getSocket();
    socket.emit('dice:roll', { heldDiceIndices: heldIndices });
  },

  selectScore: (category) => {
    const socket = getSocket();
    socket.emit('score:select', { category });
    set({ possibleScores: null });
  },

  resetGame: () => {
    sessionStorage.removeItem('roomId');
    set({
      roomId: null,
      gameState: null,
      phase: 'home',
      possibleScores: null,
      error: null,
      lobbyPlayers: [],
      isHost: false,
      rankings: null,
    });
  },

  reconnectToGame: () => {
    const playerId = sessionStorage.getItem('playerId');
    const roomId = sessionStorage.getItem('roomId');
    if (!playerId || !roomId) return false;

    set({ playerId, roomId });
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    socket.emit('player:reconnect', { playerId, roomId });
    return true;
  },

  subscribeToRoomList: () => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    socket.emit('roomList:subscribe');
  },

  unsubscribeFromRoomList: () => {
    const socket = getSocket();
    socket.emit('roomList:unsubscribe');
  },

  startGame: () => {
    const { roomId } = get();
    if (!roomId) return;
    const socket = getSocket();
    socket.emit('room:start', { roomId });
  },

  leaveRoom: () => {
    const { roomId } = get();
    if (!roomId) return;
    const socket = getSocket();
    socket.emit('room:leave', { roomId });
    sessionStorage.removeItem('roomId');
    set({
      roomId: null,
      gameState: null,
      phase: 'roomList',
      lobbyPlayers: [],
      isHost: false,
    });
  },

  initSocket: () => {
    const socket = getSocket();

    socket.off('room:created');
    socket.off('room:joined');
    socket.off('game:start');
    socket.off('turn:start');
    socket.off('dice:result');
    socket.off('score:update');
    socket.off('game:end');
    socket.off('game:state');
    socket.off('room:error');
    socket.off('player:disconnected');
    socket.off('player:reconnected');
    socket.off('roomList:update');
    socket.off('lobby:update');

    socket.on('room:created', (payload: RoomCreatedPayload & { playerId?: string; roomName?: string; maxPlayers?: number }) => {
      if (payload.playerId) {
        sessionStorage.setItem('playerId', payload.playerId);
        set({ playerId: payload.playerId });
      }
      sessionStorage.setItem('roomId', payload.roomId);
      set({
        roomId: payload.roomId,
        phase: 'waiting',
        roomName: payload.roomName || '',
        maxPlayers: payload.maxPlayers || 4,
        isHost: true,
        lobbyPlayers: [{ id: get().playerId || '', nickname: get().nickname }],
      });
    });

    socket.on('room:joined', (payload: RoomJoinedPayload & { playerId?: string; roomName?: string; maxPlayers?: number }) => {
      if (payload.playerId) {
        sessionStorage.setItem('playerId', payload.playerId);
        set({ playerId: payload.playerId });
      }
      sessionStorage.setItem('roomId', payload.roomId);
      set({
        roomId: payload.roomId,
        phase: 'waiting',
        roomName: payload.roomName || '',
        maxPlayers: payload.maxPlayers || 4,
        isHost: false,
        lobbyPlayers: payload.players,
      });
    });

    socket.on('roomList:update', (payload: { rooms: RoomListItem[] }) => {
      set({ roomList: payload.rooms });
    });

    socket.on('lobby:update', (payload: LobbyUpdatePayload) => {
      const { playerId } = get();
      set({
        lobbyPlayers: payload.players,
        maxPlayers: payload.maxPlayers,
        isHost: payload.hostPlayerId === playerId,
      });
    });

    socket.on('turn:start', (payload: TurnStartPayload) => {
      set((state) => {
        if (!state.gameState) return {};
        return {
          gameState: {
            ...state.gameState,
            currentPlayerIndex: state.gameState.players.findIndex(
              (p) => p?.id === payload.playerId
            ),
            currentRound: payload.currentRound,
            turnTimer: payload.timer,
            dice: {
              ...state.gameState.dice,
              rollsLeft: payload.rollsLeft,
              held: [false, false, false, false, false],
            },
          },
          possibleScores: null,
        };
      });
    });

    socket.on('dice:result', (payload: DiceResultPayload) => {
      set((state) => {
        if (!state.gameState) return {};
        const newDice = {
          ...state.gameState.dice,
          values: payload.dice,
          rollsLeft: payload.rollsLeft,
        };
        const possible = calculatePossibleScores(Array.from(payload.dice));
        return {
          gameState: { ...state.gameState, dice: newDice },
          possibleScores: possible,
        };
      });
    });

    socket.on('score:update', (payload: ScoreUpdatePayload) => {
      set((state) => {
        if (!state.gameState) return {};
        const players = state.gameState.players.map((p) => {
          if (!p || p.id !== payload.playerId) return p;
          return {
            ...p,
            scorecard: payload.scorecard,
            upperTotal: payload.upperTotal,
            upperBonus: payload.upperBonus,
            totalScore: payload.totalScore,
          };
        });
        return { gameState: { ...state.gameState, players } };
      });
    });

    socket.on('game:end', (payload: GameEndPayload) => {
      set((state) => {
        if (!state.gameState) return { phase: 'finished' as const, rankings: payload.rankings };
        return {
          phase: 'finished' as const,
          rankings: payload.rankings,
          gameState: {
            ...state.gameState,
            phase: 'finished',
            winner: payload.winner,
          },
        };
      });
    });

    socket.on('game:state', (payload: GameStatePayload) => {
      const gs = payload.gameState;
      const { playerId } = get();
      const myIndex = gs.players.findIndex(p => p?.id === playerId);
      const isMyTurn = myIndex === gs.currentPlayerIndex;
      const hasRolled = gs.dice.rollsLeft < 3;
      const possible = isMyTurn && hasRolled
        ? calculatePossibleScores(Array.from(gs.dice.values))
        : null;

      let phase: GameStore['phase'];
      if (gs.phase === 'finished') phase = 'finished';
      else if (gs.phase === 'playing') phase = 'playing';
      else phase = 'waiting';

      set({
        gameState: gs,
        roomId: gs.roomId,
        phase,
        possibleScores: possible,
        roomName: gs.roomName,
        maxPlayers: gs.maxPlayers,
        isHost: gs.hostPlayerId === playerId,
      });
    });

    socket.on('error', (payload: ErrorPayload) => {
      set({ error: payload.message });
    });

    socket.on('room:error', (payload: ErrorPayload) => {
      set({ error: payload.message });
    });

    socket.on('player:disconnected', (payload: { playerId: string }) => {
      set((state) => {
        if (!state.gameState) return {};
        const players = state.gameState.players.map((p) =>
          p?.id === payload.playerId ? { ...p, connected: false } : p
        );
        return { gameState: { ...state.gameState, players } };
      });
    });

    socket.on('player:reconnected', (payload: { playerId: string }) => {
      set((state) => {
        if (!state.gameState) return {};
        const players = state.gameState.players.map((p) =>
          p?.id === payload.playerId ? { ...p, connected: true } : p
        );
        return { gameState: { ...state.gameState, players } };
      });
    });

    socket.off('connect');
    socket.on('connect', () => {
      // On reconnect, re-identify with server
      const playerId = sessionStorage.getItem('playerId');
      const roomId = sessionStorage.getItem('roomId');
      if (playerId && roomId) {
        socket.emit('player:reconnect', { playerId, roomId });
      }
    });
  },
}));
