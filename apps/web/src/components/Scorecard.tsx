'use client';

import type { ScoreCategory, Scorecard as ScorecardType } from '@yacht-dice/shared';
import {
  UPPER_CATEGORIES,
  LOWER_CATEGORIES,
  CATEGORY_LABELS,
  UPPER_BONUS_THRESHOLD,
  UPPER_BONUS_SCORE,
} from '@yacht-dice/shared';

interface ScorecardProps {
  scorecard: ScorecardType;
  upperTotal: number;
  upperBonus: boolean;
  totalScore: number;
  possibleScores: Record<ScoreCategory, number> | null;
  isMyTurn: boolean;
  hasRolled: boolean;
  onSelectCategory: (category: ScoreCategory) => void;
}

function CategoryRow({
  category,
  score,
  possible,
  isMyTurn,
  hasRolled,
  onSelect,
}: {
  category: ScoreCategory;
  score: number | null;
  possible: number | null;
  isMyTurn: boolean;
  hasRolled: boolean;
  onSelect: (c: ScoreCategory) => void;
}) {
  const isScored = score !== null;
  const canSelect = isMyTurn && hasRolled && !isScored;
  const showPossible = canSelect && possible !== null;

  return (
    <button
      onClick={() => canSelect && onSelect(category)}
      disabled={!canSelect}
      className={[
        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150',
        isScored
          ? 'bg-gray-800/50 text-gray-500 cursor-default'
          : canSelect
          ? 'bg-gray-800 hover:bg-blue-900/40 hover:border-blue-500 border border-gray-700 cursor-pointer active:scale-95'
          : 'bg-gray-800/50 border border-gray-700/50 cursor-default text-gray-400',
      ].join(' ')}
    >
      <span className={isScored ? 'line-through' : ''}>{CATEGORY_LABELS[category]}</span>
      <span
        className={[
          'font-bold min-w-[2rem] text-right',
          isScored
            ? 'text-gray-400'
            : showPossible
            ? possible > 0
              ? 'text-blue-400'
              : 'text-gray-500'
            : 'text-gray-600',
        ].join(' ')}
      >
        {isScored ? (
          <span className="flex items-center gap-1">
            <span className="text-green-500 text-xs">✓</span>
            {score}
          </span>
        ) : showPossible ? (
          possible
        ) : (
          '—'
        )}
      </span>
    </button>
  );
}

export default function Scorecard({
  scorecard,
  upperTotal,
  upperBonus,
  totalScore,
  possibleScores,
  isMyTurn,
  hasRolled,
  onSelectCategory,
}: ScorecardProps) {
  const bonusRemaining = Math.max(0, UPPER_BONUS_THRESHOLD - upperTotal);

  return (
    <div className="space-y-3">
      {/* Upper section */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 px-1">
          상단 (Upper)
        </div>
        <div className="space-y-1">
          {UPPER_CATEGORIES.map((cat) => (
            <CategoryRow
              key={cat}
              category={cat}
              score={scorecard[cat]}
              possible={possibleScores?.[cat] ?? null}
              isMyTurn={isMyTurn}
              hasRolled={hasRolled}
              onSelect={onSelectCategory}
            />
          ))}
        </div>
        <div className="mt-2 px-3 py-2 bg-gray-800 rounded-lg flex justify-between text-sm">
          <span className="text-gray-400">소계</span>
          <span className="text-white font-semibold">{upperTotal} / {UPPER_BONUS_THRESHOLD}</span>
        </div>
        <div className="mt-1 px-3 py-1.5 bg-gray-800 rounded-lg flex justify-between text-sm">
          <span className="text-gray-400">보너스 +{UPPER_BONUS_SCORE}</span>
          {upperBonus ? (
            <span className="text-green-400 font-semibold">획득!</span>
          ) : (
            <span className="text-gray-500">
              {bonusRemaining > 0 ? `${bonusRemaining}점 남음` : '미달'}
            </span>
          )}
        </div>
      </div>

      {/* Lower section */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 px-1">
          하단 (Lower)
        </div>
        <div className="space-y-1">
          {LOWER_CATEGORIES.map((cat) => (
            <CategoryRow
              key={cat}
              category={cat}
              score={scorecard[cat]}
              possible={possibleScores?.[cat] ?? null}
              isMyTurn={isMyTurn}
              hasRolled={hasRolled}
              onSelect={onSelectCategory}
            />
          ))}
        </div>
      </div>

      {/* Grand total */}
      <div className="px-3 py-3 bg-gray-700 rounded-xl flex justify-between">
        <span className="text-gray-300 font-semibold">총점</span>
        <span className="text-xl font-bold text-yellow-400">{totalScore}</span>
      </div>
    </div>
  );
}
