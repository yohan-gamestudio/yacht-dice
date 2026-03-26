'use client';

import type { PlayerState } from '@yacht-dice/shared';

interface PlayerBarProps {
  players: PlayerState[];
  currentPlayerIndex: number;
  myPlayerId: string | null;
}

export default function PlayerBar({ players, currentPlayerIndex, myPlayerId }: PlayerBarProps) {
  const useGrid = players.length > 2;

  return (
    <div className={useGrid ? 'grid grid-cols-2 gap-2 w-full' : 'flex gap-3 w-full'}>
      {players.map((player, i) => {
        if (!player) {
          return (
            <div
              key={i}
              className="flex-1 rounded-xl bg-gray-800 border-2 border-gray-700 p-3 flex items-center justify-center text-gray-500 text-sm"
            >
              대기 중...
            </div>
          );
        }

        const isCurrentTurn = i === currentPlayerIndex;
        const isMe = player.id === myPlayerId;

        return (
          <div
            key={player.id}
            className={[
              'flex-1 rounded-xl border-2 p-3 transition-all duration-300',
              isCurrentTurn
                ? 'bg-yellow-400/10 border-yellow-400 shadow-lg shadow-yellow-400/20'
                : 'bg-gray-800 border-gray-700',
            ].join(' ')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={[
                    'text-sm font-bold truncate',
                    useGrid ? 'max-w-[60px]' : 'max-w-[80px]',
                    isCurrentTurn ? 'text-yellow-400' : 'text-gray-300',
                  ].join(' ')}
                >
                  {player.nickname}
                  {isMe && <span className="text-xs text-gray-400 ml-1">(나)</span>}
                </span>
                {!player.connected && (
                  <span className="text-xs text-red-400 font-medium">오프라인</span>
                )}
              </div>
              {isCurrentTurn && (
                <span className="text-yellow-400 text-xs animate-pulse">▶</span>
              )}
            </div>
            <div
              className={[
                'text-2xl font-bold mt-1',
                isCurrentTurn ? 'text-yellow-300' : 'text-white',
              ].join(' ')}
            >
              {player.totalScore}
            </div>
            {player.upperBonus && (
              <div className="text-xs text-green-400 mt-0.5">+35 보너스</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
