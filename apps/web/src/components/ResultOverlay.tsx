'use client';

import { motion } from 'framer-motion';
import type { GameEndPayload } from '@yacht-dice/shared';

interface ResultOverlayProps {
  gameState: {
    winner: string | null;
    players: ({ id: string; nickname: string; totalScore: number; upperBonus: boolean } | undefined)[];
  };
  myPlayerId: string | null;
  onClose: () => void;
}

export default function ResultOverlay({ gameState, myPlayerId, onClose }: ResultOverlayProps) {
  const winner = gameState.players.find((p) => p?.id === gameState.winner);
  const isWinner = gameState.winner === myPlayerId;

  const sorted = [...gameState.players]
    .filter(Boolean)
    .sort((a, b) => (b?.totalScore ?? 0) - (a?.totalScore ?? 0)) as {
    id: string;
    nickname: string;
    totalScore: number;
    upperBonus: boolean;
  }[];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{gameState.winner === null ? '🤝' : isWinner ? '🏆' : '💀'}</div>
          <h2 className="text-2xl font-bold text-white">
            {gameState.winner === null
              ? '무승부!'
              : isWinner
              ? '승리!'
              : '패배...'}
          </h2>
          {winner && (
            <p className="text-gray-400 mt-1 text-sm">
              {isWinner ? '축하합니다!' : `${winner.nickname} 님이 이겼습니다`}
            </p>
          )}
        </div>

        <div className="space-y-3 mb-6">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={[
                'flex items-center justify-between rounded-xl p-3',
                i === 0 ? 'bg-yellow-400/10 border border-yellow-400/50' : 'bg-gray-800',
              ].join(' ')}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{i === 0 ? '🥇' : '🥈'}</span>
                <div>
                  <div className="text-white font-semibold">
                    {p.nickname}
                    {p.id === myPlayerId && <span className="text-gray-400 text-xs ml-1">(나)</span>}
                  </div>
                  {p.upperBonus && <div className="text-green-400 text-xs">보너스 +35</div>}
                </div>
              </div>
              <div className="text-xl font-bold text-white">{p.totalScore}</div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold text-lg transition-colors"
        >
          홈으로
        </button>
      </motion.div>
    </motion.div>
  );
}
