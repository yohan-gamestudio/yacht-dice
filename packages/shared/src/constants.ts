import type { ScoreCategory, Scorecard } from './types';

export const UPPER_CATEGORIES: ScoreCategory[] = [
  'aces', 'twos', 'threes', 'fours', 'fives', 'sixes',
];

export const LOWER_CATEGORIES: ScoreCategory[] = [
  'choice', 'fourOfAKind', 'fullHouse',
  'smallStraight', 'largeStraight', 'yacht',
];

export const ALL_CATEGORIES: ScoreCategory[] = [
  ...UPPER_CATEGORIES,
  ...LOWER_CATEGORIES,
];

export const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  aces: 'Aces (1)',
  twos: 'Twos (2)',
  threes: 'Threes (3)',
  fours: 'Fours (4)',
  fives: 'Fives (5)',
  sixes: 'Sixes (6)',
  choice: 'Choice',
  fourOfAKind: '4 of a Kind',
  fullHouse: 'Full House',
  smallStraight: 'S. Straight',
  largeStraight: 'L. Straight',
  yacht: 'Yacht',
};

export const UPPER_BONUS_THRESHOLD = 63;
export const UPPER_BONUS_SCORE = 35;

export const SMALL_STRAIGHT_SCORE = 15;
export const LARGE_STRAIGHT_SCORE = 30;
export const YACHT_SCORE = 50;

export const MAX_ROLLS = 3;
export const MAX_ROUNDS = 12;
export const TURN_TIMER_SECONDS = 30;
export const DICE_COUNT = 5;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 2; // PoC: 2 players only

export function createEmptyScorecard(): Scorecard {
  return {
    aces: null,
    twos: null,
    threes: null,
    fours: null,
    fives: null,
    sixes: null,
    choice: null,
    fourOfAKind: null,
    fullHouse: null,
    smallStraight: null,
    largeStraight: null,
    yacht: null,
  };
}
