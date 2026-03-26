'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/stores/gameStore';
import { MAX_ROLLS, TURN_TIMER_SECONDS } from '@yacht-dice/shared';
import Dice from '@/components/Dice';
import Scorecard from '@/components/Scorecard';
import PlayerBar from '@/components/PlayerBar';
import ResultOverlay from '@/components/ResultOverlay';

export default function GamePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const router = useRouter();
  const {
    playerId,
    gameState,
    phase,
    possibleScores,
    rollDice,
    selectScore,
    resetGame,
    initSocket,
  } = useGameStore();

  const [heldDice, setHeldDice] = useState<boolean[]>([false, false, false, false, false]);
  const [isRolling, setIsRolling] = useState(false);
  const [timer, setTimer] = useState(TURN_TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    initSocket();
  }, []);

  // Try reconnect if no game state
  useEffect(() => {
    if (!gameState && phase === 'home') {
      const store = useGameStore.getState();
      const reconnected = store.reconnectToGame();
      if (!reconnected) {
        router.push('/');
      }
    }
  }, [gameState, phase, router]);

  // Timer countdown
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return;

    setTimer(TURN_TIMER_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState?.currentPlayerIndex, gameState?.currentRound]);

  // Reset held dice on new turn
  useEffect(() => {
    setHeldDice([false, false, false, false, false]);
  }, [gameState?.currentPlayerIndex, gameState?.currentRound]);

  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  const me = gameState.players.find((p) => p?.id === playerId);
  const myIndex = gameState.players.findIndex((p) => p?.id === playerId);
  const isMyTurn = myIndex === gameState.currentPlayerIndex;
  const rollsLeft = gameState.dice.rollsLeft;
  const hasRolled = rollsLeft < MAX_ROLLS;
  const canRoll = isMyTurn && rollsLeft > 0;

  const handleRoll = () => {
    if (!canRoll) return;
    const heldIndices = heldDice
      .map((held, i) => (held ? i : -1))
      .filter((i) => i >= 0);

    setIsRolling(true);
    rollDice(heldIndices);
    setTimeout(() => setIsRolling(false), 500);
  };

  const handleToggleDice = (index: number) => {
    if (!isMyTurn || !hasRolled) return;
    setHeldDice((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const handleSelectCategory = (category: Parameters<typeof selectScore>[0]) => {
    selectScore(category);
    setHeldDice([false, false, false, false, false]);
  };

  const handleGoHome = () => {
    resetGame();
    router.push('/');
  };

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            R<span className="text-white font-bold">{gameState.currentRound}</span>/12
          </span>
          <span className={`text-sm font-mono font-bold ${timer <= 10 ? 'text-red-400' : 'text-yellow-400'}`}>
            {timer}s
          </span>
        </div>
        <div className="text-sm text-gray-400">
          굴림 <span className="text-white font-bold">{MAX_ROLLS - rollsLeft}</span>/{MAX_ROLLS}
        </div>
      </div>

      {/* Player bar */}
      <div className="px-4 py-3">
        <PlayerBar
          players={gameState.players}
          currentPlayerIndex={gameState.currentPlayerIndex}
          myPlayerId={playerId}
        />
      </div>

      {/* Turn indicator */}
      <div className="text-center py-1">
        <span className={`text-sm font-semibold ${isMyTurn ? 'text-yellow-400' : 'text-gray-500'}`}>
          {isMyTurn ? '내 턴' : '상대 턴 - 대기 중...'}
        </span>
      </div>

      {/* Dice area */}
      <div className="px-4 py-4">
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <div className="flex justify-center gap-3 mb-4">
            {gameState.dice.values.map((value, i) => (
              <Dice
                key={i}
                value={value}
                held={heldDice[i]}
                index={i}
                canToggle={isMyTurn && hasRolled}
                isRolling={isRolling}
                onToggle={handleToggleDice}
              />
            ))}
          </div>
          {isMyTurn && hasRolled && (
            <p className="text-center text-xs text-gray-500">주사위를 탭하여 유지(KEEP)</p>
          )}
        </div>
      </div>

      {/* Roll button */}
      <div className="px-4 pb-3">
        <button
          onClick={handleRoll}
          disabled={!canRoll}
          className={`w-full py-3.5 rounded-xl font-bold text-lg transition-all ${
            canRoll
              ? 'bg-red-500 hover:bg-red-400 text-white active:scale-95'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
        >
          {!isMyTurn
            ? '상대 턴'
            : rollsLeft === MAX_ROLLS
            ? '주사위 굴리기'
            : rollsLeft > 0
            ? `다시 굴리기 (${rollsLeft}회 남음)`
            : '카테고리를 선택하세요'}
        </button>
      </div>

      {/* Scorecard */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <Scorecard
          players={gameState.players}
          myPlayerId={playerId}
          currentPlayerIndex={gameState.currentPlayerIndex}
          possibleScores={isMyTurn ? possibleScores : null}
          isMyTurn={isMyTurn}
          hasRolled={hasRolled}
          onSelectCategory={handleSelectCategory}
        />
      </div>

      {/* Result overlay */}
      {phase === 'finished' && (
        <ResultOverlay
          gameState={gameState}
          myPlayerId={playerId}
          onClose={handleGoHome}
        />
      )}
    </div>
  );
}
