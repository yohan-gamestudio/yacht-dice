'use client';

import { motion } from 'framer-motion';

interface DiceProps {
  value: number;
  held: boolean;
  index: number;
  canToggle: boolean;
  isRolling: boolean;
  onToggle: (index: number) => void;
}

const dotPositions: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

export default function Dice({ value, held, index, canToggle, isRolling, onToggle }: DiceProps) {
  const dots = dotPositions[value] || [];
  const isEmpty = value === 0;

  return (
    <motion.div
      onClick={() => canToggle && onToggle(index)}
      animate={
        isRolling && !held
          ? {
              rotate: [0, -15, 15, -10, 10, 0],
              x: [0, -4, 4, -2, 2, 0],
            }
          : { rotate: 0, x: 0 }
      }
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      className={[
        'relative w-16 h-16 rounded-xl select-none transition-all duration-200',
        isEmpty
          ? 'bg-gray-700 border-4 border-gray-600'
          : held
          ? 'bg-yellow-400 border-4 border-yellow-300 shadow-lg shadow-yellow-400/50 scale-105'
          : 'bg-white border-4 border-gray-200',
        canToggle ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-default',
      ].join(' ')}
    >
      {!isEmpty && (
        <svg viewBox="0 0 100 100" className="w-full h-full p-1">
          {dots.map(([cx, cy], i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={8}
              fill={held ? '#78350f' : '#1f2937'}
            />
          ))}
        </svg>
      )}
    </motion.div>
  );
}
