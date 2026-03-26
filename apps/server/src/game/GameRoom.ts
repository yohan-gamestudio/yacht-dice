import {
  type GameState,
  type GamePhase,
  type PlayerState,
  type DiceState,
  type DiceValues,
  type DiceHeld,
  type ScoreCategory,
  type Scorecard,
  ALL_CATEGORIES,
  MAX_ROUNDS,
  MAX_ROLLS,
  TURN_TIMER_SECONDS,
  createEmptyScorecard,
} from '@yacht-dice/shared';
import { rollDice, createInitialDice } from './DiceEngine.js';
import {
  calculateScore,
  calculatePossibleScores,
  calculateUpperTotal,
  checkUpperBonus,
  calculateTotalScore,
} from './ScoreCalculator.js';

export interface PlayerInit {
  id: string;
  socketId: string;
  nickname: string;
}

function makePlayerState(p: PlayerInit): PlayerState {
  return {
    id: p.id,
    socketId: p.socketId,
    nickname: p.nickname,
    scorecard: createEmptyScorecard(),
    upperTotal: 0,
    upperBonus: false,
    totalScore: 0,
    connected: true,
  };
}

function makeInitialDiceState(): DiceState {
  return {
    values: [1, 1, 1, 1, 1],
    held: [false, false, false, false, false],
    rollsLeft: MAX_ROLLS,
  };
}

export class GameRoom {
  private roomId: string;
  private players: [PlayerState, PlayerState?];
  private phase: GamePhase = 'waiting';
  private currentPlayerIndex: 0 | 1 = 0;
  private currentRound: number = 1;
  // Track how many categories each player has scored this round
  // Actually track total scores submitted per player to derive rounds
  private turnsCompleted: [number, number] = [0, 0];
  private dice: DiceState = makeInitialDiceState();
  private winner: string | null = null;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private onTimeoutCallback: (() => void) | null = null;

  constructor(roomId: string, hostPlayer: PlayerInit) {
    this.roomId = roomId;
    this.players = [makePlayerState(hostPlayer)];
  }

  join(player: PlayerInit): void {
    if (this.players.length >= 2) {
      throw new Error('Room is full');
    }
    if (this.phase !== 'waiting') {
      throw new Error('Game already started');
    }
    this.players[1] = makePlayerState(player);
    this.startGame();
  }

  private startGame(): void {
    this.phase = 'playing';
    this.currentPlayerIndex = 0;
    this.currentRound = 1;
    this.turnsCompleted = [0, 0];
    this.dice = {
      values: [0, 0, 0, 0, 0] as DiceValues,
      held: [false, false, false, false, false],
      rollsLeft: MAX_ROLLS,
    };
  }

  roll(playerId: string, heldIndices: number[]): DiceState {
    this.assertPlaying();
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.id !== playerId) {
      throw new Error('Not your turn');
    }
    if (this.dice.rollsLeft <= 0) {
      throw new Error('No rolls left');
    }

    const newValues = rollDice(this.dice.values, heldIndices);
    const newHeld: DiceHeld = [false, false, false, false, false];
    for (const i of heldIndices) {
      if (i >= 0 && i < 5) newHeld[i] = true;
    }

    this.dice = {
      values: newValues,
      held: newHeld,
      rollsLeft: this.dice.rollsLeft - 1,
    };

    return this.dice;
  }

  selectScore(
    playerId: string,
    category: ScoreCategory,
    onTimeout: () => void,
  ): { playerState: PlayerState; nextPlayerId: string; isGameOver: boolean } {
    this.assertPlaying();
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.id !== playerId) {
      throw new Error('Not your turn');
    }
    if (currentPlayer.scorecard[category] !== null) {
      throw new Error('Category already scored');
    }

    // Clear existing timer
    this.clearTimer();

    const score = calculateScore([...this.dice.values], category);
    currentPlayer.scorecard[category] = score;
    currentPlayer.upperTotal = calculateUpperTotal(currentPlayer.scorecard);
    currentPlayer.upperBonus = checkUpperBonus(currentPlayer.upperTotal);
    currentPlayer.totalScore = calculateTotalScore(currentPlayer.scorecard);

    // Track turns
    const playerIdx = this.currentPlayerIndex;
    this.turnsCompleted[playerIdx]++;

    // Advance to next player
    this.advanceTurn();

    // Check if game over
    const isGameOver = this.checkGameOver();

    if (isGameOver) {
      this.phase = 'finished';
      this.determineWinner();
    } else {
      // Reset dice for new turn
      this.dice = {
        values: [0, 0, 0, 0, 0] as DiceValues,
        held: [false, false, false, false, false],
        rollsLeft: MAX_ROLLS,
      };
      // Start turn timer for next player
      this.startTimer(onTimeout);
    }

    return {
      playerState: currentPlayer,
      nextPlayerId: this.getCurrentPlayer().id,
      isGameOver,
    };
  }

  handleTimeout(): ScoreCategory | null {
    if (this.phase !== 'playing') return null;
    const currentPlayer = this.getCurrentPlayer();
    // If dice haven't been rolled yet, auto-roll
    if (this.dice.rollsLeft === MAX_ROLLS) {
      this.dice = {
        values: rollDice([0, 0, 0, 0, 0] as DiceValues, []),
        held: [false, false, false, false, false],
        rollsLeft: 0,
      };
    }
    // Find best available category
    const possible = calculatePossibleScores([...this.dice.values]);
    let bestCat: ScoreCategory | null = null;
    let bestScore = -1;
    for (const cat of ALL_CATEGORIES) {
      if (currentPlayer.scorecard[cat] === null) {
        if (possible[cat] > bestScore) {
          bestScore = possible[cat];
          bestCat = cat;
        }
      }
    }
    // If all tied at 0 or only 0s, pick first available
    if (bestCat === null) {
      for (const cat of ALL_CATEGORIES) {
        if (currentPlayer.scorecard[cat] === null) {
          bestCat = cat;
          break;
        }
      }
    }
    return bestCat;
  }

  reconnect(playerId: string, newSocketId: string): void {
    const player = this.players.find(p => p?.id === playerId);
    if (!player) throw new Error('Player not found');
    player.socketId = newSocketId;
    player.connected = true;
  }

  disconnect(playerId: string): void {
    const player = this.players.find(p => p?.id === playerId);
    if (player) player.connected = false;
  }

  getState(): GameState {
    return {
      roomId: this.roomId,
      phase: this.phase,
      players: this.players as [PlayerState, PlayerState?],
      currentPlayerIndex: this.currentPlayerIndex,
      currentRound: this.currentRound,
      dice: this.dice,
      turnTimer: TURN_TIMER_SECONDS,
      winner: this.winner,
    };
  }

  isFinished(): boolean {
    return this.phase === 'finished';
  }

  areAllDisconnected(): boolean {
    return this.players.every(p => p && !p.connected);
  }

  getRoomId(): string {
    return this.roomId;
  }

  getPlayerById(playerId: string): PlayerState | undefined {
    return this.players.find(p => p?.id === playerId);
  }

  getCurrentPlayer(): PlayerState {
    const p = this.players[this.currentPlayerIndex];
    if (!p) throw new Error('Current player not set');
    return p;
  }

  startInitialTimer(onTimeout: () => void): void {
    this.startTimer(onTimeout);
  }

  private advanceTurn(): void {
    // Switch to other player
    const nextIndex = this.currentPlayerIndex === 0 ? 1 : 0;
    this.currentPlayerIndex = nextIndex as 0 | 1;

    // Round = min of turns each player has completed + 1
    // After both players have played N turns, we're in round N+1
    const minTurns = Math.min(this.turnsCompleted[0], this.turnsCompleted[1]);
    this.currentRound = minTurns + 1;
  }

  private checkGameOver(): boolean {
    return (
      this.turnsCompleted[0] >= MAX_ROUNDS &&
      this.turnsCompleted[1] >= MAX_ROUNDS
    );
  }

  private determineWinner(): void {
    const p0 = this.players[0];
    const p1 = this.players[1];
    if (!p0 || !p1) {
      this.winner = p0?.id ?? null;
      return;
    }
    if (p0.totalScore > p1.totalScore) {
      this.winner = p0.id;
    } else if (p1.totalScore > p0.totalScore) {
      this.winner = p1.id;
    } else {
      this.winner = null; // tie
    }
  }

  private startTimer(onTimeout: () => void): void {
    this.clearTimer();
    this.onTimeoutCallback = onTimeout;
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null;
      if (this.onTimeoutCallback) {
        this.onTimeoutCallback();
      }
    }, TURN_TIMER_SECONDS * 1000);
  }

  private clearTimer(): void {
    if (this.turnTimer !== null) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    this.onTimeoutCallback = null;
  }

  private assertPlaying(): void {
    if (this.phase !== 'playing') {
      throw new Error('Game is not in playing phase');
    }
  }
}
