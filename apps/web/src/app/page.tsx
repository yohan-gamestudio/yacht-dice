'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/stores/gameStore';

export default function Home() {
  const router = useRouter();
  const {
    nickname,
    setNickname,
    phase,
    roomId,
    error,
    initSocket,
    resetGame,
  } = useGameStore();

  useEffect(() => {
    initSocket();
    resetGame();
  }, []);

  useEffect(() => {
    if (phase === 'playing' && roomId) {
      router.push(`/game/${roomId}`);
    }
  }, [phase, roomId, router]);

  const handleStart = () => {
    if (!nickname.trim()) return;
    router.push('/rooms');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Title */}
        <div className="text-center space-y-2">
          <div className="text-6xl">{'\uD83C\uDFB2'}</div>
          <h1 className="text-4xl font-bold text-yellow-400 tracking-tight">
            YACHT DICE
          </h1>
          <p className="text-gray-500 text-sm">{'\uBA40\uD2F0\uD50C\uB808\uC774 \uC694\uD2B8 \uB2E4\uC774\uC2A4'}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Nickname + Start */}
        <div className="space-y-4">
          <input
            type="text"
            placeholder={'\uB2C9\uB124\uC784 \uC785\uB825'}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={10}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 transition-colors text-center text-lg"
            onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); }}
          />
          <button
            onClick={handleStart}
            disabled={!nickname.trim()}
            className="w-full py-3.5 bg-red-500 hover:bg-red-400 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-white font-bold text-lg transition-colors"
          >
            {'\uAC8C\uC784 \uC2DC\uC791'}
          </button>
        </div>
      </div>
    </div>
  );
}
