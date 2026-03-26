import {
  type ScoreCategory,
  type Scorecard,
  ALL_CATEGORIES,
  UPPER_BONUS_THRESHOLD,
  UPPER_BONUS_SCORE,
  SMALL_STRAIGHT_SCORE,
  LARGE_STRAIGHT_SCORE,
  YACHT_SCORE,
} from '@yacht-dice/shared';

export function calculateScore(dice: number[], category: ScoreCategory): number {
  const counts = new Array(7).fill(0);
  for (const d of dice) counts[d]++;

  const sum = dice.reduce((a, b) => a + b, 0);

  switch (category) {
    case 'aces':   return counts[1] * 1;
    case 'twos':   return counts[2] * 2;
    case 'threes': return counts[3] * 3;
    case 'fours':  return counts[4] * 4;
    case 'fives':  return counts[5] * 5;
    case 'sixes':  return counts[6] * 6;

    case 'choice': return sum;

    case 'fourOfAKind':
      return counts.some(c => c >= 4) ? sum : 0;

    case 'fullHouse': {
      const hasThree = counts.some(c => c === 3);
      const hasTwo = counts.some(c => c === 2);
      // Must have exactly 3 of one + 2 of another (no 5-of-a-kind)
      return hasThree && hasTwo ? sum : 0;
    }

    case 'smallStraight': {
      const unique = [...new Set(dice)].sort((a, b) => a - b);
      let maxRun = 1;
      let run = 1;
      for (let i = 1; i < unique.length; i++) {
        if (unique[i] === unique[i - 1] + 1) {
          run++;
          if (run > maxRun) maxRun = run;
        } else {
          run = 1;
        }
      }
      return maxRun >= 4 ? SMALL_STRAIGHT_SCORE : 0;
    }

    case 'largeStraight': {
      const unique = [...new Set(dice)].sort((a, b) => a - b);
      if (unique.length < 5) return 0;
      let isConsecutive = true;
      for (let i = 1; i < unique.length; i++) {
        if (unique[i] !== unique[i - 1] + 1) {
          isConsecutive = false;
          break;
        }
      }
      return isConsecutive ? LARGE_STRAIGHT_SCORE : 0;
    }

    case 'yacht':
      return counts.some(c => c === 5) ? YACHT_SCORE : 0;

    default:
      return 0;
  }
}

export function calculatePossibleScores(dice: number[]): Record<ScoreCategory, number> {
  const result = {} as Record<ScoreCategory, number>;
  for (const cat of ALL_CATEGORIES) {
    result[cat] = calculateScore(dice, cat);
  }
  return result;
}

export function calculateUpperTotal(scorecard: Scorecard): number {
  const upperCats: ScoreCategory[] = ['aces', 'twos', 'threes', 'fours', 'fives', 'sixes'];
  return upperCats.reduce((sum, cat) => sum + (scorecard[cat] ?? 0), 0);
}

export function checkUpperBonus(upperTotal: number): boolean {
  return upperTotal >= UPPER_BONUS_THRESHOLD;
}

export function calculateTotalScore(scorecard: Scorecard): number {
  const upperTotal = calculateUpperTotal(scorecard);
  const bonus = checkUpperBonus(upperTotal) ? UPPER_BONUS_SCORE : 0;
  const lowerCats: ScoreCategory[] = ['choice', 'fourOfAKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yacht'];
  const lowerTotal = lowerCats.reduce((sum, cat) => sum + (scorecard[cat] ?? 0), 0);
  return upperTotal + bonus + lowerTotal;
}
