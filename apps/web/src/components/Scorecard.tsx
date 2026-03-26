'use client';

import type { ScoreCategory, PlayerState } from '@yacht-dice/shared';
import {
  UPPER_CATEGORIES,
  LOWER_CATEGORIES,
  CATEGORY_LABELS,
  UPPER_BONUS_THRESHOLD,
  UPPER_BONUS_SCORE,
} from '@yacht-dice/shared';

const DICE_ICONS: Record<ScoreCategory, string> = {
  aces: '\u2680',
  twos: '\u2681',
  threes: '\u2682',
  fours: '\u2683',
  fives: '\u2684',
  sixes: '\u2685',
  choice: '\uD83C\uDFB2',
  fourOfAKind: '\u2683\u2683',
  fullHouse: '\u2682\u2681',
  smallStraight: '\u2680\u2681\u2682\u2683',
  largeStraight: '\u2680\u2681\u2682\u2683\u2684',
  yacht: '\u2B50',
};

interface ScorecardProps {
  players: PlayerState[];
  myPlayerId: string | null;
  currentPlayerIndex: number;
  possibleScores: Record<ScoreCategory, number> | null;
  isMyTurn: boolean;
  hasRolled: boolean;
  onSelectCategory: (category: ScoreCategory) => void;
}

function ScoreCell({
  score,
  possible,
  canSelect,
  isCurrentTurn,
  isMe,
  onClick,
}: {
  score: number | null;
  possible: number | null;
  canSelect: boolean;
  isCurrentTurn: boolean;
  isMe: boolean;
  onClick?: () => void;
}) {
  const isScored = score !== null;
  const showPossible = canSelect && possible !== null;

  return (
    <button
      onClick={onClick}
      disabled={!canSelect}
      className={[
        'h-full w-full flex items-center justify-center text-sm font-bold transition-all',
        isScored
          ? isMe
            ? 'bg-yellow-400/20 text-yellow-300'
            : 'bg-gray-700/50 text-gray-400'
          : canSelect
          ? 'bg-yellow-400/10 hover:bg-yellow-400/30 text-yellow-400 cursor-pointer active:scale-90'
          : isCurrentTurn
          ? 'bg-gray-800/50 text-gray-600'
          : 'bg-gray-800/30 text-gray-700',
      ].join(' ')}
    >
      {isScored ? score : showPossible ? possible : ''}
    </button>
  );
}

function getColWidth(playerCount: number): string {
  if (playerCount <= 2) return '72px';
  if (playerCount === 3) return '60px';
  return '52px';
}

function getGridCols(playerCount: number): string {
  const colW = getColWidth(playerCount);
  const cols = Array(playerCount).fill(colW).join('_');
  return `grid-cols-[1fr_${cols}]`;
}

export default function Scorecard({
  players,
  myPlayerId,
  currentPlayerIndex,
  possibleScores,
  isMyTurn,
  hasRolled,
  onSelectCategory,
}: ScorecardProps) {
  const myIndex = players.findIndex((p) => p?.id === myPlayerId);
  const playerCount = players.length;
  const colW = getColWidth(playerCount);

  // Build grid template style dynamically
  const gridStyle = {
    gridTemplateColumns: `1fr ${players.map(() => colW).join(' ')}`,
  };

  function renderRow(cat: ScoreCategory) {
    const allJoined = players.length >= 2;
    const canSelect = isMyTurn && hasRolled && allJoined;

    return (
      <div
        key={cat}
        className="grid border-b border-gray-800/60 h-9"
        style={gridStyle}
      >
        <div className="flex items-center gap-2 px-3 text-sm">
          <span className="text-xs opacity-60">{DICE_ICONS[cat]}</span>
          <span className="text-gray-300">{CATEGORY_LABELS[cat]}</span>
        </div>
        {players.map((player, i) => {
          const isMe = player?.id === myPlayerId;
          const isCurrent = i === currentPlayerIndex;
          const score = player?.scorecard[cat] ?? null;
          const canSelectThis = canSelect && isMe && isCurrent && score === null && hasRolled;

          return (
            <ScoreCell
              key={i}
              score={score}
              possible={canSelectThis ? (possibleScores?.[cat] ?? null) : null}
              canSelect={!!canSelectThis}
              isCurrentTurn={isCurrent}
              isMe={!!isMe}
              onClick={canSelectThis ? () => onSelectCategory(cat) : undefined}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="grid h-11 bg-gray-800" style={gridStyle}>
        <div className="flex items-center px-3">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Categories</span>
        </div>
        {players.map((player, i) => (
          <div
            key={i}
            className={[
              'flex items-center justify-center text-xs font-bold',
              i === currentPlayerIndex
                ? 'bg-yellow-400/20 text-yellow-400'
                : 'text-gray-500',
              player?.id === myPlayerId ? 'underline' : '',
            ].join(' ')}
          >
            {player ? (player.id === myPlayerId ? '\uB098' : player.nickname.slice(0, playerCount > 2 ? 3 : 4)) : '\u2014'}
          </div>
        ))}
      </div>

      {/* Upper section label */}
      <div className="grid h-7 bg-gray-850" style={gridStyle}>
        <div className="flex items-center px-3">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Upper</span>
        </div>
        {players.map((_, i) => <div key={i} />)}
      </div>

      {/* Upper categories */}
      {UPPER_CATEGORIES.map(renderRow)}

      {/* Subtotal row */}
      <div className="grid h-9 bg-gray-800/80 border-y border-gray-700/50" style={gridStyle}>
        <div className="flex items-center px-3 text-xs font-semibold text-gray-400">
          Subtotal
        </div>
        {players.map((player, i) => (
          <div key={i} className="flex items-center justify-center text-xs font-bold text-gray-400">
            {player ? `${player.upperTotal}/${UPPER_BONUS_THRESHOLD}` : '\u2014'}
          </div>
        ))}
      </div>

      {/* Bonus row */}
      <div className="grid h-9 bg-gray-800/60 border-b border-gray-700/50" style={gridStyle}>
        <div className="flex items-center px-3 text-xs font-semibold text-gray-400">
          +{UPPER_BONUS_SCORE} Bonus
        </div>
        {players.map((player, i) => (
          <div
            key={i}
            className={[
              'flex items-center justify-center text-xs font-bold',
              player?.upperBonus ? 'text-green-400' : 'text-gray-600',
            ].join(' ')}
          >
            {player?.upperBonus ? `+${UPPER_BONUS_SCORE}` : '\u2014'}
          </div>
        ))}
      </div>

      {/* Lower section label */}
      <div className="grid h-7" style={gridStyle}>
        <div className="flex items-center px-3">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Lower</span>
        </div>
        {players.map((_, i) => <div key={i} />)}
      </div>

      {/* Lower categories */}
      {LOWER_CATEGORIES.map(renderRow)}

      {/* Total row */}
      <div className="grid h-12 bg-gray-800 border-t border-gray-700" style={gridStyle}>
        <div className="flex items-center px-3 text-sm font-bold text-white">
          Total
        </div>
        {players.map((player, i) => (
          <div
            key={i}
            className={[
              'flex items-center justify-center text-lg font-black',
              player?.id === myPlayerId ? 'text-yellow-400' : 'text-white',
            ].join(' ')}
          >
            {player?.totalScore ?? 0}
          </div>
        ))}
      </div>
    </div>
  );
}
