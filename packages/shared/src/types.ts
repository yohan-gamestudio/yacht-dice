export type ScoreCategory =
  | 'aces'
  | 'twos'
  | 'threes'
  | 'fours'
  | 'fives'
  | 'sixes'
  | 'choice'
  | 'fourOfAKind'
  | 'fullHouse'
  | 'smallStraight'
  | 'largeStraight'
  | 'yacht';

export type Scorecard = Record<ScoreCategory, number | null>;

export type DiceValues = [number, number, number, number, number];
export type DiceHeld = [boolean, boolean, boolean, boolean, boolean];

export interface DiceState {
  values: DiceValues;
  held: DiceHeld;
  rollsLeft: number;
}

export type GamePhase = 'waiting' | 'playing' | 'finished';

export interface PlayerState {
  id: string;
  socketId: string;
  nickname: string;
  scorecard: Scorecard;
  upperTotal: number;
  upperBonus: boolean;
  totalScore: number;
  connected: boolean;
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: [PlayerState, PlayerState?];
  currentPlayerIndex: 0 | 1;
  currentRound: number;
  dice: DiceState;
  turnTimer: number;
  winner: string | null;
}

// Socket event payloads
export interface RoomJoinPayload {
  nickname: string;
  roomId?: string;
  playerId?: string;
}

export interface RoomCreatedPayload {
  roomId: string;
}

export interface RoomJoinedPayload {
  roomId: string;
  players: { id: string; nickname: string }[];
}

export interface DiceRollPayload {
  heldDiceIndices: number[];
}

export interface DiceResultPayload {
  dice: DiceValues;
  rollsLeft: number;
}

export interface ScoreSelectPayload {
  category: ScoreCategory;
}

export interface ScoreUpdatePayload {
  playerId: string;
  category: ScoreCategory;
  score: number;
  scorecard: Scorecard;
  upperTotal: number;
  upperBonus: boolean;
  totalScore: number;
}

export interface TurnStartPayload {
  playerId: string;
  rollsLeft: number;
  timer: number;
  currentRound: number;
}

export interface GameEndPayload {
  winner: string | null;
  players: {
    id: string;
    nickname: string;
    totalScore: number;
    scorecard: Scorecard;
    upperBonus: boolean;
  }[];
}

export interface GameStatePayload {
  gameState: GameState;
}

export interface ErrorPayload {
  message: string;
}
