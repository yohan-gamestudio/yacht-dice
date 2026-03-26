'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/stores/gameStore';
import type { RoomSettings } from '@yacht-dice/shared';

export default function RoomsPage() {
  const router = useRouter();
  const {
    nickname,
    phase,
    roomId,
    roomList,
    lobbyPlayers,
    isHost,
    maxPlayers,
    roomName,
    error,
    initSocket,
    subscribeToRoomList,
    unsubscribeFromRoomList,
    createRoom,
    joinRoom,
    startGame,
    leaveRoom,
  } = useGameStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newMaxPlayers, setNewMaxPlayers] = useState<2 | 3 | 4>(4);

  useEffect(() => {
    if (!nickname) {
      router.push('/');
      return;
    }
    initSocket();
    subscribeToRoomList();
    return () => {
      unsubscribeFromRoomList();
    };
  }, []);

  useEffect(() => {
    if (phase === 'playing' && roomId) {
      router.push(`/game/${roomId}`);
    }
  }, [phase, roomId, router]);

  const handleCreate = () => {
    const settings: RoomSettings = {
      roomName: newRoomName.trim() || `${nickname}의 방`,
      maxPlayers: newMaxPlayers,
    };
    createRoom(settings);
    setShowCreateModal(false);
  };

  const handleJoinRoom = (targetRoomId: string) => {
    joinRoom(targetRoomId);
  };

  // Waiting room view
  if (phase === 'waiting' && roomId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="text-4xl">🎲</div>
            <h1 className="text-2xl font-bold text-yellow-400">{roomName || '대기실'}</h1>
            <div className="flex items-center justify-center gap-2">
              <span className="text-gray-500 text-sm">방 코드:</span>
              <span className="text-lg font-mono font-bold text-white tracking-widest">{roomId}</span>
              <button
                onClick={() => navigator.clipboard.writeText(roomId)}
                className="text-xs text-gray-400 hover:text-white transition-colors ml-1"
              >
                복사
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Player slots */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-gray-400">플레이어</span>
              <span className="text-sm text-gray-500">{lobbyPlayers.length}/{maxPlayers}</span>
            </div>
            {Array.from({ length: maxPlayers }).map((_, i) => {
              const player = lobbyPlayers[i];
              return (
                <div
                  key={i}
                  className={[
                    'rounded-xl border-2 p-4 transition-all',
                    player
                      ? 'bg-gray-800 border-gray-600'
                      : 'bg-gray-900/50 border-gray-800 border-dashed',
                  ].join(' ')}
                >
                  {player ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center text-yellow-400 text-sm font-bold">
                          {player.nickname.charAt(0)}
                        </div>
                        <span className="text-white font-semibold">{player.nickname}</span>
                        {i === 0 && (
                          <span className="text-xs bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-full">방장</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-gray-600 text-sm">
                      <div className="w-2 h-2 bg-gray-700 rounded-full animate-pulse mr-2" />
                      대기 중...
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {isHost ? (
              <button
                onClick={startGame}
                disabled={lobbyPlayers.length < 2}
                className="w-full py-3.5 bg-red-500 hover:bg-red-400 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-white font-bold text-lg transition-colors"
              >
                {lobbyPlayers.length < 2 ? '2명 이상 필요' : '게임 시작'}
              </button>
            ) : (
              <div className="w-full py-3.5 bg-gray-800 rounded-xl text-gray-400 font-bold text-lg text-center">
                방장이 시작할 때까지 대기 중...
              </div>
            )}
            <button
              onClick={() => {
                leaveRoom();
              }}
              className="w-full py-2.5 text-sm text-gray-500 hover:text-white transition-colors"
            >
              나가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Room list view
  return (
    <div className="flex-1 flex flex-col items-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl">🎲</div>
          <h1 className="text-2xl font-bold text-yellow-400">게임 로비</h1>
          <p className="text-gray-500 text-sm">{nickname} 님, 환영합니다!</p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Create room button */}
        <button
          onClick={() => {
            setNewRoomName(`${nickname}의 방`);
            setShowCreateModal(true);
          }}
          className="w-full py-3.5 bg-red-500 hover:bg-red-400 rounded-xl text-white font-bold text-lg transition-colors"
        >
          방 만들기
        </button>

        {/* Room list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-semibold text-gray-400">대기 중인 방</span>
            <span className="text-xs text-gray-600">{roomList.length}개</span>
          </div>
          {roomList.length === 0 ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
              <p className="text-gray-600 text-sm">대기 중인 방이 없습니다</p>
              <p className="text-gray-700 text-xs mt-1">새로운 방을 만들어보세요!</p>
            </div>
          ) : (
            roomList.map((room) => (
              <div
                key={room.roomId}
                className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center justify-between hover:border-gray-700 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold truncate">{room.roomName}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-500">{room.hostNickname}</span>
                    <span className="text-xs text-gray-600">
                      {room.currentPlayerCount}/{room.maxPlayers}명
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleJoinRoom(room.roomId)}
                  disabled={room.currentPlayerCount >= room.maxPlayers}
                  className="ml-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-white text-sm font-bold transition-colors"
                >
                  {room.currentPlayerCount >= room.maxPlayers ? '만원' : '참가'}
                </button>
              </div>
            ))
          )}
        </div>

        <button
          onClick={() => router.push('/')}
          className="w-full text-sm text-gray-500 hover:text-white transition-colors"
        >
          홈으로
        </button>
      </div>

      {/* Create room modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-5">
            <h2 className="text-xl font-bold text-white text-center">방 만들기</h2>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1.5">방 이름</label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  maxLength={20}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 transition-colors"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1.5">최대 인원</label>
                <div className="flex gap-2">
                  {([2, 3, 4] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => setNewMaxPlayers(n)}
                      className={[
                        'flex-1 py-2.5 rounded-xl font-bold text-lg transition-colors',
                        newMaxPlayers === n
                          ? 'bg-yellow-400 text-gray-900'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700',
                      ].join(' ')}
                    >
                      {n}명
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-bold transition-colors hover:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold transition-colors"
              >
                만들기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
