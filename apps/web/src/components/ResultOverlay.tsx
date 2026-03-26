'use client';

import { motion } from 'framer-motion';
import type { GameEndPayload } from '@yacht-dice/shared';

interface ResultOverlayProps {
  gameState: {
    winner: string | null;
    players: { id: string; nickname: string; totalScore: number; upperBonus: boolean }[];
  };
  rankings: GameEndPayload['rankings'] | null;
  myPlayerId: string | null;
  onClose: () => void;
}

const RANK_MEDALS = ['🥇', '🥈', '🥉', '4th'];

export default function ResultOverlay({ gameState, rankings, myPlayerId, onClose }: ResultOverlayProps) {
  const sorted = rankings
    ? rankings
    : [...gameState.players]
        .filter(Boolean)
        .sort((a, b) => b.totalScore - a.totalScore)
        .map((p, i) => ({ ...p, rank: i + 1, scorecard: {} as never, upperBonus: p.upperBonus }));

  const myRanking = sorted.find(r => r.id === myPlayerId);
  const isWinner = myRanking?.rank === 1;
  const isTie = gameState.winner === null;

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
          <div className="text-5xl mb-3">
            {isTie ? '🤝' : isWinner ? '🏆' : '💀'}
          </div>
          <h2 className="text-2xl font-bold text-white">
            {isTie ? '무승부!' : isWinner ? '승리!' : '패배...'}
          </h2>
          {myRanking && !isTie && !isWinner && (
            <p className="text-gray-400 mt-1 text-sm">
              {myRanking.rank}위
            </p>
          )}
        </div>

        <div className="space-y-3 mb-6">
          {sorted.map((p) => {
            const medal = p.rank <= 3 ? RANK_MEDALS[p.rank - 1] : `${p.rank}th`;
            const isTop = p.rank === 1;
            const isMe = p.id === myPlayerId;

            return (
              <div
                key={p.id}
                className={[
                  'flex items-center justify-between rounded-xl p-3',
                  isTop ? 'bg-yellow-400/10 border border-yellow-400/50' : 'bg-gray-800',
                  isMe ? 'ring-2 ring-yellow-400/30' : '',
                ].join(' ')}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg w-8 text-center">{medal}</span>
                  <div>
                    <div className="text-white font-semibold">
                      {p.nickname}
                      {isMe && <span className="text-gray-400 text-xs ml-1">(나)</span>}
                    </div>
                    {p.upperBonus && <div className="text-green-400 text-xs">보너스 +35</div>}
                  </div>
                </div>
                <div className="text-xl font-bold text-white">{p.totalScore}</div>
              </div>
            );
          })}
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
