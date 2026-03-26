import { type DiceValues } from '@yacht-dice/shared';

function randomDie(): number {
  const buf = new Uint8Array(1);
  // Use rejection sampling to avoid modulo bias
  let val: number;
  do {
    crypto.getRandomValues(buf);
    val = buf[0];
  } while (val >= 252); // 252 = floor(256/6)*6
  return (val % 6) + 1;
}

export function rollDice(currentValues: DiceValues, heldIndices: number[]): DiceValues {
  const held = new Set(heldIndices);
  const result = [...currentValues] as DiceValues;
  for (let i = 0; i < 5; i++) {
    if (!held.has(i)) {
      result[i] = randomDie();
    }
  }
  return result;
}

export function createInitialDice(): DiceValues {
  return [randomDie(), randomDie(), randomDie(), randomDie(), randomDie()];
}
