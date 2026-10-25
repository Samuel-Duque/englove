'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ActivityRuntimeProps,
  GamePublicConfig,
  GameAnswers,
  MemorySettings,
  MemorySolution,
  deterministicShuffle,
} from '@englove/shared';
import { soundManager } from '../../../lib/sound';

export function MemoryGame({
  config,
  initialState,
  theme = 'kids',
  soundEnabled = true,
  previewMode = false,
  onEvent,
  onComplete,
}: ActivityRuntimeProps<GamePublicConfig, GameAnswers>) {
  const settings = config.settings as MemorySettings;
  const solution = config.answerKey?.solution as MemorySolution | undefined;

  const originalCards = settings?.cards || [];

  // Deterministic shuffle of cards (RF-5, §4 Rule 5)
  const shuffledCards = useMemo(() => {
    const seed = originalCards.map((c) => c.id).join('-') + (solution?.pairs?.map((p) => p.join('-')).join('-') || 'seed');
    return deterministicShuffle(originalCards, seed);
  }, [originalCards, solution]);

  const pairKey = (idA: string, idB: string) => (idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`);

  const expectedPairKeys = useMemo(() => {
    const set = new Set<string>();
    if (solution?.pairs) {
      for (const [a, b] of solution.pairs) {
        set.add(pairKey(a, b));
      }
    }
    return set;
  }, [solution]);

  // Selections list: [cardA, cardB][]
  const [selections, setSelections] = useState<Array<[string, string]>>(() => {
    return initialState?.selections ? [...initialState.selections] : [];
  });

  // Reconstruct resolved pairs from selections on mount (RF-5 Acceptance Criterion 3)
  const resolvedCardIds = useMemo(() => {
    const resolved = new Set<string>();
    for (const tuple of selections) {
      if (Array.isArray(tuple) && tuple.length === 2) {
        const [a, b] = tuple;
        if (a && b && a !== b && expectedPairKeys.has(pairKey(a, b))) {
          resolved.add(a);
          resolved.add(b);
        }
      }
    }
    return resolved;
  }, [selections, expectedPairKeys]);

  // Current turn: cards currently flipped in this round (0, 1, or 2)
  const [activeFlippedIds, setActiveFlippedIds] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const totalPairsCount = solution?.pairs ? solution.pairs.length : originalCards.length / 2;
  const foundPairsCount = resolvedCardIds.size / 2;

  const handleCardClick = (cardId: string) => {
    if (isLocked) return;
    if (resolvedCardIds.has(cardId)) return;
    if (activeFlippedIds.includes(cardId)) return;

    if (activeFlippedIds.length === 0) {
      setActiveFlippedIds([cardId]);
      return;
    }

    if (activeFlippedIds.length === 1) {
      const firstCardId = activeFlippedIds[0]!;
      const currentTurn: [string, string] = [firstCardId, cardId];
      setActiveFlippedIds([firstCardId, cardId]);
      setIsLocked(true);

      const nextSelections = [...selections, currentTurn];
      setSelections(nextSelections);
      onEvent?.({ itemId: 'selections', answer: nextSelections });

      const isMatch = expectedPairKeys.has(pairKey(firstCardId, cardId));

      if (isMatch) {
        soundManager.play('hit', soundEnabled);
        setIsLocked(false);
        setActiveFlippedIds([]);

        // Check if all pairs are now found
        if (foundPairsCount + 1 >= totalPairsCount) {
          soundManager.play('complete', soundEnabled);
        }
      } else {
        soundManager.play('miss', soundEnabled);
        // Flip back after 900 ms (RF-5 Acceptance Criterion 2)
        timeoutRef.current = setTimeout(() => {
          setActiveFlippedIds([]);
          setIsLocked(false);
        }, 900);
      }
    }
  };

  const handleComplete = () => {
    soundManager.play('complete', soundEnabled);
    onComplete?.({ selections });
  };

  const isKids = theme === 'kids';

  return (
    <div
      className={`w-full max-w-4xl mx-auto p-4 sm:p-6 rounded-3xl ${
        isKids
          ? 'bg-amber-50/70 border-2 border-amber-200'
          : 'bg-zinc-900 border border-zinc-800 text-zinc-100'
      }`}
    >
      {previewMode && (
        <div className="mb-4 p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold text-center">
          👀 Vista previa: no se guardan respuestas
        </div>
      )}

      {config.instructions && (
        <div className="mb-6 p-4 rounded-2xl bg-white/80 border border-amber-200/60 shadow-xs">
          <p className="text-sm sm:text-base font-semibold text-zinc-800 leading-relaxed">
            {config.instructions}
          </p>
        </div>
      )}

      {/* Grid of cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {shuffledCards.map((card) => {
          const isResolved = resolvedCardIds.has(card.id);
          const isTurnFlipped = activeFlippedIds.includes(card.id);
          const isFaceUp = isResolved || isTurnFlipped;

          return (
            <button
              key={card.id}
              type="button"
              disabled={isFaceUp || isLocked}
              onClick={() => handleCardClick(card.id)}
              className={`min-h-24 sm:min-h-28 rounded-2xl p-3 border-2 font-black text-sm sm:text-base flex items-center justify-center text-center shadow-xs transition-all touch-manipulation cursor-pointer select-none ${
                isFaceUp
                  ? isResolved
                    ? 'border-emerald-400 bg-emerald-100/90 text-emerald-950 scale-102 ring-2 ring-emerald-300'
                    : 'border-amber-400 bg-amber-100 text-amber-950 scale-105 ring-4 ring-amber-300'
                  : isKids
                    ? 'border-amber-300 bg-gradient-to-br from-amber-400 to-amber-500 text-white hover:from-amber-500 hover:to-amber-600 active:scale-95'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 active:scale-95'
              }`}
              aria-label={isFaceUp ? card.text : 'Tarjeta oculta'}
            >
              {isFaceUp ? (
                <div className="flex flex-col items-center gap-1">
                  <span>{card.text}</span>
                  {isResolved && <span className="text-xs">✨</span>}
                </div>
              ) : (
                <span className="text-2xl" aria-hidden="true">
                  ❓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-amber-200/60 flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-500">
          Parejas encontradas: {foundPairsCount} de {totalPairsCount} · Turnos jugados: {selections.length}
        </p>

        <button
          type="button"
          onClick={handleComplete}
          className={`min-h-12 min-w-12 px-6 py-3 rounded-2xl font-black text-sm shadow-md transition-transform active:scale-95 touch-manipulation ${
            isKids
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          Finalizar juego de memoria ✨
        </button>
      </div>
    </div>
  );
}

export default MemoryGame;
