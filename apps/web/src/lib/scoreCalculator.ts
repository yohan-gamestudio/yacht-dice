import type { ScoreCategory } from '@yacht-dice/shared';
import {
  SMALL_STRAIGHT_SCORE,
  LARGE_STRAIGHT_SCORE,
  YACHT_SCORE,
} from '@yacht-dice/shared';

function counts(dice: number[]): Record<number, number> {
  const c: Record<number, number> = {};
  for (const d of dice) {
    c[d] = (c[d] || 0) + 1;
  }
  return c;
}

function sumAll(dice: number[]): number {
  return dice.reduce((a, b) => a + b, 0);
}

export function calculateScore(category: ScoreCategory, dice: number[]): number {
  const c = counts(dice);
  const vals = Object.values(c);

  switch (category) {
    case 'aces':
      return (c[1] || 0) * 1;
    case 'twos':
      return (c[2] || 0) * 2;
    case 'threes':
      return (c[3] || 0) * 3;
    case 'fours':
      return (c[4] || 0) * 4;
    case 'fives':
      return (c[5] || 0) * 5;
    case 'sixes':
      return (c[6] || 0) * 6;
    case 'choice':
      return sumAll(dice);
    case 'fourOfAKind':
      return vals.some((v) => v >= 4) ? sumAll(dice) : 0;
    case 'fullHouse': {
      const hasThree = vals.some((v) => v === 3);
      const hasTwo = vals.some((v) => v === 2);
      return hasThree && hasTwo ? sumAll(dice) : 0;
    }
    case 'smallStraight': {
      const sorted = [...new Set(dice)].sort();
      const str = sorted.join('');
      return str.includes('1234') || str.includes('2345') || str.includes('3456')
        ? SMALL_STRAIGHT_SCORE
        : 0;
    }
    case 'largeStraight': {
      const sorted = [...new Set(dice)].sort();
      if (sorted.length < 5) return 0;
      const str = sorted.join('');
      return str === '12345' || str === '23456' ? LARGE_STRAIGHT_SCORE : 0;
    }
    case 'yacht':
      return vals.length === 1 && vals[0] === 5 ? YACHT_SCORE : 0;
    default:
      return 0;
  }
}

export function calculatePossibleScores(dice: number[]): Record<ScoreCategory, number> {
  const categories: ScoreCategory[] = [
    'aces', 'twos', 'threes', 'fours', 'fives', 'sixes',
    'choice', 'fourOfAKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yacht',
  ];

  const result = {} as Record<ScoreCategory, number>;
  for (const cat of categories) {
    result[cat] = calculateScore(cat, dice);
  }
  return result;
}
