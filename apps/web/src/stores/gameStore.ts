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
} from '@yacht-dice/shared';
import { getSocket } from '@/lib/socket';
import { calculatePossibleScores } from '@/lib/scoreCalculator';

interface GameStore {
  playerId: string | null;
  nickname: string;
  roomId: string | null;
  gameState: GameState | null;
  phase: 'home' | 'waiting' | 'playing' | 'finished';
  possibleScores: Record<ScoreCategory, number> | null;
  error: string | null;

  setNickname: (name: string) => void;
  createRoom: () => void;
  joinRoom: (roomId: string) => void;
  rollDice: (heldIndices: number[]) => void;
  selectScore: (category: ScoreCategory) => void;
  initSocket: () => void;
  resetGame: () => void;
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

  setNickname: (name) => set({ nickname: name }),

  createRoom: () => {
    const { nickname } = get();
    const playerId = getOrCreatePlayerId();
    set({ playerId });
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    socket.emit('room:join', { nickname, playerId });
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
    set({
      roomId: null,
      gameState: null,
      phase: 'home',
      possibleScores: null,
      error: null,
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

    socket.on('room:created', (payload: RoomCreatedPayload & { playerId?: string }) => {
      if (payload.playerId) {
        sessionStorage.setItem('playerId', payload.playerId);
        set({ playerId: payload.playerId });
      }
      set({ roomId: payload.roomId, phase: 'waiting' });
    });

    socket.on('room:joined', (payload: RoomJoinedPayload & { playerId?: string }) => {
      if (payload.playerId) {
        sessionStorage.setItem('playerId', payload.playerId);
        set({ playerId: payload.playerId });
      }
      set({ roomId: payload.roomId });
    });

    socket.on('turn:start', (payload: TurnStartPayload) => {
      set((state) => {
        if (!state.gameState) return {};
        return {
          gameState: {
            ...state.gameState,
            currentPlayerIndex: state.gameState.players.findIndex(
              (p) => p?.id === payload.playerId
            ) as 0 | 1,
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
        }) as GameState['players'];
        return { gameState: { ...state.gameState, players } };
      });
    });

    socket.on('game:end', (payload: GameEndPayload) => {
      set((state) => {
        if (!state.gameState) return { phase: 'finished' as const };
        return {
          phase: 'finished' as const,
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
      set({
        gameState: gs,
        roomId: gs.roomId,
        phase: gs.phase === 'finished' ? 'finished' : gs.phase === 'playing' ? 'playing' : 'waiting',
        possibleScores: possible,
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
        ) as GameState['players'];
        return { gameState: { ...state.gameState, players } };
      });
    });

    socket.on('player:reconnected', (payload: { playerId: string }) => {
      set((state) => {
        if (!state.gameState) return {};
        const players = state.gameState.players.map((p) =>
          p?.id === payload.playerId ? { ...p, connected: true } : p
        ) as GameState['players'];
        return { gameState: { ...state.gameState, players } };
      });
    });
  },
}));
