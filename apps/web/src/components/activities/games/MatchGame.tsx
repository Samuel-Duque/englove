'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ActivityRuntimeProps,
  GamePublicConfig,
  GameAnswers,
  MatchSettings,
  MatchSolution,
  deterministicShuffle,
} from '@englove/shared';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { soundManager } from '../../../lib/sound';

export function MatchGame({
  config,
  initialState,
  theme = 'kids',
  soundEnabled = true,
  previewMode = false,
  onEvent,
  onComplete,
}: ActivityRuntimeProps<GamePublicConfig, GameAnswers>) {
  const settings = config.settings as MatchSettings;
  const solution = config.answerKey?.solution as MatchSolution | undefined;

  const leftItems = settings?.left || [];
  const rightOriginal = settings?.right || [];

  // Deterministic shuffle of right column (RF-2, §4 Rule 5)
  // Seed with left items' IDs + solution signature
  const seed = useMemo(() => {
    return leftItems.map((l) => l.id).join('-') + (solution ? Object.values(solution.pairs || {}).join('-') : 'seed');
  }, [leftItems, solution]);

  const shuffledRight = useMemo(() => {
    const shuffled = deterministicShuffle(rightOriginal, seed);
    // Ensure not identical to original left sequence if possible
    return shuffled;
  }, [rightOriginal, seed]);

  // Pairs state: leftId -> rightId
  const [pairs, setPairs] = useState<Record<string, string>>(() => {
    return initialState?.pairs ? { ...initialState.pairs } : {};
  });

  // Selected left item for 2-step click/touch & keyboard
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);

  // Inverted map for quick lookup: rightId -> leftId
  const rightToLeftMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [lId, rId] of Object.entries(pairs)) {
      if (rId) map.set(rId, lId);
    }
    return map;
  }, [pairs]);

  // Handle pairing action
  const handleLink = (leftId: string, rightId: string) => {
    setPairs((prev) => {
      const next = { ...prev };

      // Free previous assignment of rightId if used by another leftId
      for (const [lKey, rVal] of Object.entries(next)) {
        if (rVal === rightId && lKey !== leftId) {
          delete next[lKey];
        }
      }

      next[leftId] = rightId;

      // Sound & feedback
      if (solution?.pairs) {
        const isCorrect = solution.pairs[leftId] === rightId;
        soundManager.play(isCorrect ? 'hit' : 'miss', soundEnabled);
      }

      onEvent?.({ itemId: 'pairs', answer: next });
      return next;
    });

    setSelectedLeftId(null);
  };

  const handleUnlink = (leftId: string) => {
    setPairs((prev) => {
      const next = { ...prev };
      delete next[leftId];
      onEvent?.({ itemId: 'pairs', answer: next });
      return next;
    });
  };

  const handleComplete = () => {
    soundManager.play('complete', soundEnabled);
    onComplete?.({ pairs });
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-start">
        {/* Left Column */}
        <div className="space-y-3">
          <h4
            className={`text-xs font-extrabold uppercase tracking-wider ${
              isKids ? 'text-amber-800' : 'text-zinc-400'
            }`}
          >
            Palabras ({leftItems.length})
          </h4>
          <div className="space-y-3">
            {leftItems.map((item) => {
              const isSelected = selectedLeftId === item.id;
              const pairedRightId = pairs[item.id];
              const pairedRightItem = pairedRightId
                ? shuffledRight.find((r) => r.id === pairedRightId)
                : null;

              return (
                <DraggableLeftItem
                  key={item.id}
                  id={item.id}
                  text={item.text}
                  isSelected={isSelected}
                  isPaired={Boolean(pairedRightId)}
                  pairedText={pairedRightItem?.text}
                  isKids={isKids}
                  onSelect={() => {
                    if (isSelected) {
                      setSelectedLeftId(null);
                    } else {
                      setSelectedLeftId(item.id);
                    }
                  }}
                  onUnlink={() => handleUnlink(item.id)}
                />
              );
            })}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-3">
          <h4
            className={`text-xs font-extrabold uppercase tracking-wider ${
              isKids ? 'text-amber-800' : 'text-zinc-400'
            }`}
          >
            Traducciones / Coincidencias ({shuffledRight.length})
          </h4>
          <div className="space-y-3">
            {shuffledRight.map((item) => {
              const pairedLeftId = rightToLeftMap.get(item.id);
              const isTargetActive = Boolean(selectedLeftId);

              return (
                <DropTargetRightItem
                  key={item.id}
                  id={item.id}
                  text={item.text}
                  isPaired={Boolean(pairedLeftId)}
                  isKids={isKids}
                  isTargetActive={isTargetActive}
                  onDropLink={(droppedLeftId) => handleLink(droppedLeftId, item.id)}
                  onClickLink={() => {
                    if (selectedLeftId) {
                      handleLink(selectedLeftId, item.id);
                    }
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-8 pt-4 border-t border-amber-200/60 flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-500">
          {Object.keys(pairs).length} de {leftItems.length} parejas formadas
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
          Finalizar emparejamiento ✨
        </button>
      </div>
    </div>
  );
}

// Subcomponent for Draggable Left Item
function DraggableLeftItem({
  id,
  text,
  isSelected,
  isPaired,
  pairedText,
  isKids,
  onSelect,
  onUnlink,
}: {
  id: string;
  text: string;
  isSelected: boolean;
  isPaired: boolean;
  pairedText?: string;
  isKids: boolean;
  onSelect: () => void;
  onUnlink: () => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    return draggable({
      element: el,
      getInitialData: () => ({ leftId: id }),
    });
  }, [id]);

  return (
    <div
      ref={elRef}
      className={`min-h-12 p-3 sm:p-4 rounded-2xl border-2 flex items-center justify-between transition-all touch-manipulation cursor-pointer select-none ${
        isSelected
          ? 'border-amber-500 ring-4 ring-amber-300 bg-amber-100/90 shadow-md'
          : isPaired
            ? 'border-emerald-400 bg-emerald-50/70'
            : isKids
              ? 'border-amber-200/80 bg-white hover:border-amber-400 hover:shadow-xs'
              : 'border-zinc-700 bg-zinc-800/80 hover:border-zinc-500'
      }`}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        } else if (e.key === 'Escape') {
          if (isSelected) onSelect();
        }
      }}
    >
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold ${isKids ? 'text-zinc-900' : 'text-zinc-100'}`}>{text}</span>
        {isPaired && pairedText && (
          <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg">
            🔗 {pairedText}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {isPaired && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUnlink();
            }}
            className="text-xs font-bold text-rose-600 hover:text-rose-800 px-2 py-1 rounded-md"
            title="Desvincular"
          >
            ✕
          </button>
        )}
        <span className="text-xs text-zinc-400 font-bold" aria-hidden="true">
          {isSelected ? '✓ Activo' : '👉'}
        </span>
      </div>
    </div>
  );
}

// Subcomponent for Drop Target Right Item
function DropTargetRightItem({
  id,
  text,
  isPaired,
  isKids,
  isTargetActive,
  onDropLink,
  onClickLink,
}: {
  id: string;
  text: string;
  isPaired: boolean;
  isKids: boolean;
  isTargetActive: boolean;
  onDropLink: (leftId: string) => void;
  onClickLink: () => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    return dropTargetForElements({
      element: el,
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: ({ source }) => {
        setIsOver(false);
        const droppedLeftId = source.data?.leftId as string | undefined;
        if (droppedLeftId) {
          onDropLink(droppedLeftId);
        }
      },
    });
  }, [id, onDropLink]);

  return (
    <div
      ref={elRef}
      className={`min-h-12 p-3 sm:p-4 rounded-2xl border-2 flex items-center justify-between transition-all touch-manipulation cursor-pointer select-none ${
        isOver
          ? 'border-indigo-500 ring-4 ring-indigo-300 bg-indigo-50 shadow-lg scale-102'
          : isTargetActive
            ? 'border-dashed border-amber-400 bg-amber-50/60 animate-pulse'
            : isPaired
              ? 'border-emerald-300 bg-emerald-50/60'
              : isKids
                ? 'border-amber-200/80 bg-white hover:border-amber-400 hover:shadow-xs'
                : 'border-zinc-700 bg-zinc-800/80 hover:border-zinc-500'
      }`}
      role="button"
      tabIndex={0}
      onClick={onClickLink}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClickLink();
        }
      }}
    >
      <span className={`text-sm font-bold ${isKids ? 'text-zinc-900' : 'text-zinc-100'}`}>{text}</span>
      <span className="text-xs text-zinc-400 font-bold" aria-hidden="true">
        {isPaired ? '✅' : isTargetActive ? '👈 Tocar aquí' : '🎯'}
      </span>
    </div>
  );
}

export default MatchGame;
