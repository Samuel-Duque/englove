'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ActivityRuntimeProps,
  GamePublicConfig,
  GameAnswers,
  OrderWordsSettings,
  OrderWordsSolution,
  deterministicShuffle,
} from '@englove/shared';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { soundManager } from '../../../lib/sound';

export function OrderWordsGame({
  config,
  initialState,
  theme = 'kids',
  soundEnabled = true,
  previewMode = false,
  onEvent,
  onComplete,
}: ActivityRuntimeProps<GamePublicConfig, GameAnswers>) {
  const settings = config.settings as OrderWordsSettings;
  const solution = config.answerKey?.solution as OrderWordsSolution | undefined;

  const originalTokens = settings?.tokens || [];

  // Deterministic bank shuffle (RF-3, §4 Rule 5)
  const initialBankTokens = useMemo(() => {
    const seed = originalTokens.map((t) => t.id).join('-') + (solution?.tokenIds?.join('-') || 'seed');
    let shuffled = deterministicShuffle(originalTokens, seed);

    // If shuffled order matches solution, reverse or rotate to guarantee difference
    if (solution?.tokenIds && shuffled.length >= 2) {
      const shuffledIds = shuffled.map((t) => t.id);
      const isIdentical = shuffledIds.every((id, idx) => id === solution.tokenIds[idx]);
      if (isIdentical) {
        shuffled = [...shuffled].reverse();
      }
    }
    return shuffled;
  }, [originalTokens, solution]);

  // Selected token IDs in the sentence line
  const [tokenIds, setTokenIds] = useState<string[]>(() => {
    if (initialState?.tokenIds && Array.isArray(initialState.tokenIds)) {
      // Validate that each id exists in settings.tokens without duplicates
      const validIds = new Set(originalTokens.map((t) => t.id));
      const seen = new Set<string>();
      const filtered: string[] = [];
      for (const id of initialState.tokenIds) {
        if (validIds.has(id) && !seen.has(id)) {
          seen.add(id);
          filtered.push(id);
        }
      }
      return filtered;
    }
    return [];
  });

  const tokenMap = useMemo(() => {
    const map = new Map<string, { id: string; text: string }>();
    for (const t of originalTokens) {
      map.set(t.id, t);
    }
    return map;
  }, [originalTokens]);

  // Tokens remaining in the bank
  const bankTokens = useMemo(() => {
    const placedSet = new Set(tokenIds);
    return initialBankTokens.filter((t) => !placedSet.has(t.id));
  }, [initialBankTokens, tokenIds]);

  const handleAddToken = (tokenId: string) => {
    if (tokenIds.includes(tokenId)) return;
    const next = [...tokenIds, tokenId];
    setTokenIds(next);
    onEvent?.({ itemId: 'tokenIds', answer: next });
  };

  const handleInsertBankToken = (tokenId: string, atIndex: number) => {
    if (tokenIds.includes(tokenId)) return;
    const next = [...tokenIds];
    next.splice(atIndex, 0, tokenId);
    setTokenIds(next);
    onEvent?.({ itemId: 'tokenIds', answer: next });
  };

  const handleRemoveToken = (tokenId: string) => {
    const next = tokenIds.filter((id) => id !== tokenId);
    setTokenIds(next);
    onEvent?.({ itemId: 'tokenIds', answer: next });
  };

  const handleMoveToken = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= tokenIds.length ||
      toIndex >= tokenIds.length
    ) {
      return;
    }
    const next = [...tokenIds];
    const [moved] = next.splice(fromIndex, 1);
    if (moved) {
      next.splice(toIndex, 0, moved);
      setTokenIds(next);
      onEvent?.({ itemId: 'tokenIds', answer: next });
    }
  };

  const handleComplete = () => {
    soundManager.play('complete', soundEnabled);
    onComplete?.({ tokenIds });
  };

  // Sentence Line drop target
  const sentenceLineRef = useRef<HTMLDivElement>(null);
  const [isOverLine, setIsOverLine] = useState(false);

  useEffect(() => {
    const el = sentenceLineRef.current;
    if (!el) return;

    return dropTargetForElements({
      element: el,
      onDragEnter: () => setIsOverLine(true),
      onDragLeave: () => setIsOverLine(false),
      onDrop: ({ source }) => {
        setIsOverLine(false);
        const data = source.data;
        if (data?.type === 'bank-token' && typeof data.tokenId === 'string') {
          handleAddToken(data.tokenId);
        }
      },
    });
  }, [tokenIds]);

  // Bank drop target (for dragging placed tokens back)
  const bankRef = useRef<HTMLDivElement>(null);
  const [isOverBank, setIsOverBank] = useState(false);

  useEffect(() => {
    const el = bankRef.current;
    if (!el) return;

    return dropTargetForElements({
      element: el,
      onDragEnter: () => setIsOverBank(true),
      onDragLeave: () => setIsOverBank(false),
      onDrop: ({ source }) => {
        setIsOverBank(false);
        const data = source.data;
        if (data?.type === 'placed-token' && typeof data.tokenId === 'string') {
          handleRemoveToken(data.tokenId);
        }
      },
    });
  }, [tokenIds]);

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

      {/* Sentence Construction Line */}
      <div className="space-y-2 mb-8">
        <div className="flex items-center justify-between">
          <h4
            className={`text-xs font-extrabold uppercase tracking-wider ${
              isKids ? 'text-amber-800' : 'text-zinc-400'
            }`}
          >
            Línea de construcción de oración:
          </h4>
          <span className="text-xs font-semibold text-zinc-500">
            {tokenIds.length} de {originalTokens.length} palabras
          </span>
        </div>

        <div
          ref={sentenceLineRef}
          className={`min-h-24 p-4 rounded-2xl border-2 border-dashed flex flex-wrap items-center gap-2.5 transition-colors ${
            isOverLine
              ? 'border-indigo-500 ring-4 ring-indigo-200 bg-indigo-50/60 shadow-md'
              : tokenIds.length === 0
                ? isKids
                  ? 'border-amber-300 bg-amber-50/40 justify-center'
                  : 'border-zinc-700 bg-zinc-800/40 justify-center'
                : isKids
                  ? 'border-amber-400 bg-white shadow-inner'
                  : 'border-zinc-700 bg-zinc-800 shadow-inner'
          }`}
        >
          {tokenIds.length === 0 ? (
            <p
              className={`text-xs sm:text-sm font-semibold text-center select-none ${
                isKids ? 'text-amber-900/60' : 'text-zinc-400'
              }`}
            >
              Arrastra o toca palabras del banco hacia aquí para construir la frase.
            </p>
          ) : (
            tokenIds.map((id, index) => {
              const token = tokenMap.get(id);
              if (!token) return null;

              return (
                <DraggablePlacedToken
                  key={id}
                  id={id}
                  index={index}
                  text={token.text}
                  totalCount={tokenIds.length}
                  isKids={isKids}
                  onMoveToken={handleMoveToken}
                  onInsertBankToken={handleInsertBankToken}
                  onRemoveToken={handleRemoveToken}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Token Bank */}
      <div className="space-y-3 mb-8">
        <h4
          className={`text-xs font-extrabold uppercase tracking-wider ${
            isKids ? 'text-amber-800' : 'text-zinc-400'
          }`}
        >
          Banco de palabras:
        </h4>

        <div
          ref={bankRef}
          className={`flex flex-wrap gap-2.5 p-4 rounded-2xl border min-h-16 items-center transition-colors ${
            isOverBank
              ? 'border-rose-400 ring-4 ring-rose-200 bg-rose-50/60'
              : 'bg-white/70 border-amber-200/80'
          }`}
        >
          {bankTokens.length === 0 ? (
            <p className="text-xs font-medium text-zinc-400 italic">
              Todas las palabras han sido colocadas en la oración.
            </p>
          ) : (
            bankTokens.map((token) => (
              <DraggableBankToken
                key={token.id}
                id={token.id}
                text={token.text}
                isKids={isKids}
                onAddToken={handleAddToken}
              />
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-amber-200/60 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setTokenIds([]);
            onEvent?.({ itemId: 'tokenIds', answer: [] });
          }}
          disabled={tokenIds.length === 0}
          className="text-xs font-bold text-zinc-500 hover:text-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          Reiniciar orden
        </button>

        <button
          type="button"
          onClick={handleComplete}
          className={`min-h-12 min-w-12 px-6 py-3 rounded-2xl font-black text-sm shadow-md transition-transform active:scale-95 touch-manipulation cursor-pointer ${
            isKids
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          Comprobar y finalizar ✨
        </button>
      </div>
    </div>
  );
}

function DraggableBankToken({
  id,
  text,
  isKids,
  onAddToken,
}: {
  id: string;
  text: string;
  isKids: boolean;
  onAddToken: (id: string) => void;
}) {
  const elRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    return draggable({
      element: el,
      getInitialData: () => ({ type: 'bank-token', tokenId: id }),
    });
  }, [id]);

  return (
    <button
      ref={elRef}
      type="button"
      onClick={() => onAddToken(id)}
      className={`min-h-12 min-w-12 px-4 py-2.5 rounded-2xl font-black text-sm border-2 shadow-xs transition-all active:scale-95 touch-manipulation cursor-grab ${
        isKids
          ? 'border-amber-300 bg-amber-200/90 text-amber-950 hover:bg-amber-300 hover:border-amber-400'
          : 'border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
      }`}
    >
      + {text}
    </button>
  );
}

function DraggablePlacedToken({
  id,
  index,
  text,
  totalCount,
  isKids,
  onMoveToken,
  onInsertBankToken,
  onRemoveToken,
}: {
  id: string;
  index: number;
  text: string;
  totalCount: number;
  isKids: boolean;
  onMoveToken: (fromIndex: number, toIndex: number) => void;
  onInsertBankToken: (tokenId: string, atIndex: number) => void;
  onRemoveToken: (tokenId: string) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const cleanupDraggable = draggable({
      element: el,
      getInitialData: () => ({ type: 'placed-token', index, tokenId: id }),
    });

    const cleanupDropTarget = dropTargetForElements({
      element: el,
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: ({ source }) => {
        setIsOver(false);
        const data = source.data;
        if (data?.type === 'placed-token' && typeof data.index === 'number') {
          onMoveToken(data.index, index);
        } else if (data?.type === 'bank-token' && typeof data.tokenId === 'string') {
          onInsertBankToken(data.tokenId, index);
        }
      },
    });

    return () => {
      cleanupDraggable();
      cleanupDropTarget();
    };
  }, [id, index, onMoveToken, onInsertBankToken]);

  return (
    <div
      ref={elRef}
      className={`group inline-flex items-center gap-1 rounded-xl border px-3 py-2 shadow-xs transition-all cursor-grab active:scale-95 ${
        isOver
          ? 'ring-2 ring-indigo-500 scale-105'
          : ''
      } ${
        isKids
          ? 'bg-amber-100 border-amber-300'
          : 'bg-zinc-700 border-zinc-600'
      }`}
    >
      <span
        className={`text-xs font-mono font-bold mr-1 select-none ${
          isKids ? 'text-amber-700' : 'text-zinc-300'
        }`}
      >
        #{index + 1}
      </span>
      <span
        className={`text-sm sm:text-base font-extrabold ${
          isKids ? 'text-amber-950' : 'text-zinc-100'
        }`}
      >
        {text}
      </span>

      {/* Reorder Left */}
      {index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveToken(index, index - 1);
          }}
          className="text-xs text-amber-700 hover:text-amber-900 px-1 font-bold cursor-pointer"
          title="Mover a la izquierda"
          aria-label="Mover a la izquierda"
        >
          ←
        </button>
      )}

      {/* Reorder Right */}
      {index < totalCount - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveToken(index, index + 1);
          }}
          className="text-xs text-amber-700 hover:text-amber-900 px-1 font-bold cursor-pointer"
          title="Mover a la derecha"
          aria-label="Mover a la derecha"
        >
          →
        </button>
      )}

      {/* Remove */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemoveToken(id);
        }}
        className="text-xs text-rose-600 hover:text-rose-800 font-black px-1.5 py-0.5 rounded-md ml-1 cursor-pointer"
        title="Devolver al banco"
        aria-label={`Devolver ${text} al banco`}
      >
        ✕
      </button>
    </div>
  );
}

export default OrderWordsGame;
