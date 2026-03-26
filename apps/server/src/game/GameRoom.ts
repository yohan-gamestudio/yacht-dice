import {
  type GameState,
  type GamePhase,
  type PlayerState,
  type DiceState,
  type DiceValues,
  type DiceHeld,
  type ScoreCategory,
  type Scorecard,
  type RoomListItem,
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
  private players: PlayerState[] = [];
  private phase: GamePhase = 'waiting';
  private currentPlayerIndex: number = 0;
  private currentRound: number = 1;
  private turnsCompleted: number[] = [];
  private dice: DiceState = makeInitialDiceState();
  private winner: string | null = null;
  private rankings: { id: string; nickname: string; totalScore: number; scorecard: Scorecard; upperBonus: boolean; rank: number }[] = [];
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private onTimeoutCallback: (() => void) | null = null;
  private roomName: string;
  private maxPlayers: number;
  private hostPlayerId: string;

  constructor(roomId: string, hostPlayer: PlayerInit, settings: { roomName: string; maxPlayers: number }) {
    this.roomId = roomId;
    this.roomName = settings.roomName;
    this.maxPlayers = settings.maxPlayers;
    this.hostPlayerId = hostPlayer.id;
    this.players = [makePlayerState(hostPlayer)];
    this.turnsCompleted = [0];
  }

  join(player: PlayerInit): void {
    if (this.players.length >= this.maxPlayers) {
      throw new Error('Room is full');
    }
    if (this.phase !== 'waiting') {
      throw new Error('Game already started');
    }
    this.players.push(makePlayerState(player));
    this.turnsCompleted.push(0);
  }

  canStart(): boolean {
    return this.phase === 'waiting' && this.players.length >= 2;
  }

  startGame(): void {
    if (!this.canStart()) {
      throw new Error('Cannot start game');
    }
    this.phase = 'playing';
    this.currentPlayerIndex = 0;
    this.currentRound = 1;
    this.turnsCompleted = Array(this.players.length).fill(0);
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

  removePlayer(playerId: string): boolean {
    if (this.phase !== 'waiting') return false;
    const idx = this.players.findIndex(p => p.id === playerId);
    if (idx === -1) return false;
    this.players.splice(idx, 1);
    this.turnsCompleted.splice(idx, 1);
    // If host left, assign new host
    if (this.hostPlayerId === playerId && this.players.length > 0) {
      this.hostPlayerId = this.players[0].id;
    }
    return true;
  }

  getState(): GameState {
    return {
      roomId: this.roomId,
      phase: this.phase,
      players: this.players,
      currentPlayerIndex: this.currentPlayerIndex,
      currentRound: this.currentRound,
      dice: this.dice,
      turnTimer: TURN_TIMER_SECONDS,
      winner: this.winner,
      maxPlayers: this.maxPlayers,
      roomName: this.roomName,
      hostPlayerId: this.hostPlayerId,
    };
  }

  getRoomListItem(): RoomListItem {
    const host = this.players.find(p => p.id === this.hostPlayerId);
    return {
      roomId: this.roomId,
      roomName: this.roomName,
      hostNickname: host?.nickname ?? '',
      currentPlayerCount: this.players.length,
      maxPlayers: this.maxPlayers,
      phase: this.phase,
    };
  }

  getRankings() {
    return this.rankings;
  }

  isFinished(): boolean {
    return this.phase === 'finished';
  }

  getPhase(): GamePhase {
    return this.phase;
  }

  areAllDisconnected(): boolean {
    return this.players.every(p => !p.connected);
  }

  getRoomId(): string {
    return this.roomId;
  }

  getHostId(): string {
    return this.hostPlayerId;
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
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;

    // Round = min of turns each player has completed + 1
    const minTurns = Math.min(...this.turnsCompleted);
    this.currentRound = minTurns + 1;
  }

  private checkGameOver(): boolean {
    return this.turnsCompleted.every(t => t >= MAX_ROUNDS);
  }

  private determineWinner(): void {
    // Sort players by totalScore descending
    const sorted = [...this.players]
      .map(p => ({
        id: p.id,
        nickname: p.nickname,
        totalScore: p.totalScore,
        scorecard: p.scorecard,
        upperBonus: p.upperBonus,
      }))
      .sort((a, b) => b.totalScore - a.totalScore);

    // Assign ranks (ties get the same rank)
    this.rankings = [];
    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].totalScore < sorted[i - 1].totalScore) {
        currentRank = i + 1;
      }
      this.rankings.push({ ...sorted[i], rank: currentRank });
    }

    // Winner is the top ranked player (or null for tie at top)
    if (this.rankings.length > 0) {
      const topScore = this.rankings[0].totalScore;
      const topPlayers = this.rankings.filter(r => r.totalScore === topScore);
      if (topPlayers.length === 1) {
        this.winner = topPlayers[0].id;
      } else {
        this.winner = null; // tie
      }
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
