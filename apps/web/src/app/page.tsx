'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/stores/gameStore';

export default function Home() {
  const router = useRouter();
  const {
    nickname,
    setNickname,
    createRoom,
    joinRoom,
    roomId,
    phase,
    error,
    initSocket,
    resetGame,
  } = useGameStore();

  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');

  useEffect(() => {
    initSocket();
    resetGame();
  }, []);

  useEffect(() => {
    if (phase === 'playing' && roomId) {
      router.push(`/game/${roomId}`);
    }
  }, [phase, roomId, router]);

  const handleCreate = () => {
    if (!nickname.trim()) return;
    setMode('create');
    createRoom();
  };

  const handleJoin = () => {
    if (!nickname.trim() || !joinCode.trim()) return;
    joinRoom(joinCode.trim().toUpperCase());
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Title */}
        <div className="text-center space-y-2">
          <div className="text-6xl">🎲</div>
          <h1 className="text-4xl font-bold text-yellow-400 tracking-tight">
            YACHT DICE
          </h1>
          <p className="text-gray-500 text-sm">멀티플레이 요트 다이스</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Waiting for opponent */}
        {mode === 'create' && phase === 'waiting' && roomId && (
          <div className="space-y-4 text-center">
            <div className="bg-gray-800 rounded-2xl p-6 space-y-3">
              <p className="text-gray-400 text-sm">방 코드를 공유하세요</p>
              <div className="text-3xl font-mono font-bold text-yellow-400 tracking-widest">
                {roomId}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(roomId)}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                복사하기
              </button>
            </div>
            <div className="flex items-center gap-2 justify-center text-gray-500">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <span className="text-sm">상대방 대기 중...</span>
            </div>
            <button
              onClick={() => { setMode('home'); resetGame(); }}
              className="text-sm text-gray-500 hover:text-white transition-colors"
            >
              취소
            </button>
          </div>
        )}

        {/* Home / Input */}
        {(mode === 'home' || (mode === 'create' && phase !== 'waiting')) && phase !== 'playing' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="닉네임 입력"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={10}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 transition-colors text-center text-lg"
            />
            <button
              onClick={handleCreate}
              disabled={!nickname.trim()}
              className="w-full py-3.5 bg-red-500 hover:bg-red-400 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-white font-bold text-lg transition-colors"
            >
              방 만들기
            </button>
            <button
              onClick={() => setMode('join')}
              disabled={!nickname.trim()}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-white font-bold text-lg transition-colors"
            >
              방 참가
            </button>
          </div>
        )}

        {/* Join mode */}
        {mode === 'join' && phase !== 'playing' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="방 코드 입력"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 transition-colors text-center text-2xl font-mono tracking-widest"
            />
            <button
              onClick={handleJoin}
              disabled={!joinCode.trim()}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-white font-bold text-lg transition-colors"
            >
              참가하기
            </button>
            <button
              onClick={() => setMode('home')}
              className="w-full text-sm text-gray-500 hover:text-white transition-colors"
            >
              뒤로
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
