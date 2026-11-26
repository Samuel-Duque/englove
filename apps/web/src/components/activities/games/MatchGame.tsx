'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ActivityRuntimeProps,
  GamePublicConfig,
  GameAnswers,
  MatchSettingsSchema,
  MatchSolutionSchema,
  deterministicShuffle,
} from '@upward-english/shared';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { soundManager } from '../../../lib/sound';
import kidsStyles from './kids-game.module.css';
import teensStyles from './teens-game.module.css';

export function MatchGame({
  config,
  initialState,
  theme = 'kids',
  soundEnabled = true,
  previewMode = false,
  onEvent,
  onComplete,
}: ActivityRuntimeProps<GamePublicConfig, GameAnswers>) {
  const parsedSettings = MatchSettingsSchema.safeParse(config.settings);
  const settings = parsedSettings.success ? parsedSettings.data : null;
  const parsedSol = MatchSolutionSchema.safeParse(config.answerKey?.solution);
  const solution = parsedSol.success ? parsedSol.data : undefined;

  const leftItems = settings?.left || [];
  const rightOriginal = settings?.right || [];

  // Deterministic shuffle of right column (RF-2, §4 Rule 5)
  // Seed with left items' IDs + solution signature
  const seed = useMemo(() => {
    return leftItems.map((l) => l.id).join('-') + (solution ? Object.values(solution.pairs || {}).join('-') : 'seed');
  }, [leftItems, solution]);

  const shuffledRight = useMemo(() => {
    let shuffled = deterministicShuffle(rightOriginal, seed);
    // Guarantee non-parallel permutation to left items if possible (SPEC-06 RF-2)
    if (solution?.pairs && shuffled.length >= 2 && leftItems.length === shuffled.length) {
      const isParallel = leftItems.every(
        (left, idx) => solution.pairs[left.id] === shuffled[idx]?.id,
      );
      if (isParallel) {
        // Reverse so it is never identical/parallel to left items
        shuffled = [...shuffled].reverse();
      }
    }
    return shuffled;
  }, [rightOriginal, seed, solution, leftItems]);

  // Pairs state: leftId -> rightId
  const [pairs, setPairs] = useState<Record<string, string>>(() => {
    return initialState?.pairs ? { ...initialState.pairs } : {};
  });

  // Selected left item for 2-step click/touch & keyboard
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string>('');

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
    const next = { ...pairs };

    // Free previous assignment of rightId if used by another leftId
    for (const [lKey, rVal] of Object.entries(next)) {
      if (rVal === rightId && lKey !== leftId) {
        delete next[lKey];
      }
    }

    next[leftId] = rightId;
    setPairs(next);
    setSelectedLeftId(null);

    const leftTxt = leftItems.find((l) => l.id === leftId)?.text ?? '';
    const rightTxt = shuffledRight.find((r) => r.id === rightId)?.text ?? '';
    setLiveStatus(`Pareja unida: ${leftTxt} con ${rightTxt}`);

    // Sound & feedback
    if (solution?.pairs) {
      const isCorrect = solution.pairs[leftId] === rightId;
      soundManager.play(isCorrect ? 'hit' : 'miss', soundEnabled);
    }

    onEvent?.({ itemId: 'pairs', answer: next });
  };

  const handleUnlink = (leftId: string) => {
    const next = { ...pairs };
    delete next[leftId];
    setPairs(next);
    const leftTxt = leftItems.find((l) => l.id === leftId)?.text ?? '';
    setLiveStatus(`Pareja desvinculada para ${leftTxt}`);
    onEvent?.({ itemId: 'pairs', answer: next });
  };

  const handleComplete = () => {
    soundManager.play('complete', soundEnabled);
    onComplete?.({ pairs });
  };

  const isKids = theme === 'kids';
  const isTeens = theme === 'teens';
  const styles = isTeens ? teensStyles : kidsStyles;

  return (
    <div
      className={`${styles.board} w-full max-w-4xl mx-auto p-4 sm:p-6 rounded-3xl ${
        isKids
          ? 'bg-amber-50/70 border-2 border-amber-200'
          : isTeens
            ? ''
            : 'bg-zinc-900 border border-zinc-800 text-zinc-100'
      }`}
    >
      {previewMode && (
        <div className="mb-4 p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold text-center">
          👀 Vista previa: no se guardan respuestas
        </div>
      )}

      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveStatus}
      </div>

      {config.instructions && (
        <div className={`${styles.legacyInstructions} mb-6 p-4 rounded-2xl bg-white/80 border border-amber-200/60 shadow-xs`}>
          <p className="text-sm sm:text-base font-semibold text-zinc-800 leading-relaxed">
            {config.instructions}
          </p>
        </div>
      )}

      <div className={`${styles.matchColumns} grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-start`}>
        {/* Left Column */}
        <div className="space-y-3">
          <h4
            className={`${styles.label} text-xs font-extrabold uppercase tracking-wider ${
              isKids ? 'text-amber-800' : isTeens ? '' : 'text-zinc-400'
            }`}
          >
            Palabras ({leftItems.length})
          </h4>
          <div className="space-y-3">
            {leftItems.map((item, index) => {
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
                  pairNumber={index + 1}
                  isKids={isKids}
                  isTeens={isTeens}
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
            className={`${styles.label} text-xs font-extrabold uppercase tracking-wider ${
              isKids ? 'text-amber-800' : isTeens ? '' : 'text-zinc-400'
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
                  pairNumber={leftItems.findIndex(({ id }) => id === pairedLeftId) + 1}
                  isKids={isKids}
                  isTeens={isTeens}
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
      <div className={`${styles.footer} mt-8 pt-4 ${isTeens ? '' : 'border-t border-amber-200/60'} flex items-center justify-between`}>
        <p className={`${styles.meta} text-xs font-medium ${isTeens ? '' : 'text-zinc-500'}`}>
          {Object.keys(pairs).length} de {leftItems.length} parejas formadas
        </p>

        <button
          type="button"
          onClick={handleComplete}
          className={`${styles.finish} min-h-12 min-w-12 px-6 py-3 rounded-2xl font-black text-sm shadow-md transition-transform active:scale-95 touch-manipulation cursor-pointer ${
            isKids
              ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 font-black'
              : isTeens
                ? ''
                : 'bg-indigo-600 hover:bg-indigo-500 text-white font-bold'
          }`}
        >
          {isTeens ? 'Finalizar emparejamiento' : 'Finalizar emparejamiento ✨'}
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
  pairNumber,
  pairedText,
  isKids,
  isTeens,
  onSelect,
  onUnlink,
}: {
  id: string;
  text: string;
  isSelected: boolean;
  isPaired: boolean;
  pairNumber: number;
  pairedText?: string;
  isKids: boolean;
  isTeens: boolean;
  onSelect: () => void;
  onUnlink: () => void;
}) {
  const styles = isTeens ? teensStyles : kidsStyles;
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
      data-state={isSelected ? 'selected' : isPaired ? 'linked' : undefined}
      className={`${styles.piece} min-h-12 p-2 sm:p-2.5 rounded-2xl border-2 flex items-center justify-between transition-all touch-manipulation select-none ${
        isTeens
          ? ''
          : isSelected
            ? 'border-amber-500 ring-4 ring-amber-300 bg-amber-100/90 shadow-md'
            : isPaired
              ? isKids
                ? 'border-emerald-400 bg-emerald-50/70'
                : 'border-emerald-600 bg-emerald-950/80'
              : isKids
                ? 'border-amber-200/80 bg-white hover:border-amber-400 hover:shadow-xs'
                : 'border-zinc-700 bg-zinc-800/80 hover:border-zinc-500'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        className={`${styles.matchControl} flex-1 flex items-center justify-between text-left p-1.5 rounded-xl cursor-pointer ${
          isTeens ? '' : 'focus:outline-none focus:ring-2 focus:ring-amber-500'
        }`}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            lang="en"
            className={`text-sm font-bold ${
              isTeens
                ? isSelected
                  ? 'text-[#872E06]'
                  : isPaired
                    ? 'text-[#166534]'
                    : 'text-[#2B150A]'
                : isSelected
                  ? 'text-zinc-900'
                  : isPaired
                    ? isKids
                      ? 'text-emerald-950'
                      : 'text-emerald-100'
                    : isKids
                      ? 'text-zinc-900'
                      : 'text-zinc-100'
            }`}
          >
            {text}
          </span>
          {isPaired && pairedText && (
            <span
              className={
                isTeens
                  ? 'text-xs font-bold text-[#166534] bg-[#E6F5EA] border border-[#166534]/30 px-2 py-0.5 rounded-lg tabular-nums'
                  : 'text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg'
              }
            >
              {isTeens ? `Pareja ${pairNumber} · ${pairedText}` : `🔗 ${pairNumber} · ${pairedText}`}
            </span>
          )}
        </div>
        <span
          className={`text-xs font-bold mr-1 ${
            isTeens
              ? isSelected
                ? 'text-[#872E06]'
                : 'text-[#5E3E2C]'
              : isSelected
                ? 'text-zinc-900'
                : 'text-zinc-400'
          }`}
          aria-hidden="true"
        >
          {isTeens ? (isSelected ? 'Seleccionado' : 'Seleccionar') : isSelected ? '✓ Activo' : '👉'}
        </span>
      </button>

      {isPaired && (
        <button
          type="button"
          onClick={onUnlink}
          className={
            isTeens
              ? `${styles.iconBtn} text-xs font-bold text-[#831712] hover:bg-[#FDECE9] ml-1 shrink-0 cursor-pointer`
              : 'min-h-6 min-w-6 inline-flex items-center justify-center text-xs font-bold text-rose-600 hover:text-rose-800 p-1 rounded-md ml-1 shrink-0 focus:outline-none focus:ring-2 focus:ring-rose-500'
          }
          title="Desvincular"
          aria-label={`Desvincular ${text}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

// Subcomponent for Drop Target Right Item
function DropTargetRightItem({
  id,
  text,
  isPaired,
  pairNumber,
  isKids,
  isTeens,
  isTargetActive,
  onDropLink,
  onClickLink,
}: {
  id: string;
  text: string;
  isPaired: boolean;
  pairNumber: number;
  isKids: boolean;
  isTeens: boolean;
  isTargetActive: boolean;
  onDropLink: (leftId: string) => void;
  onClickLink: () => void;
}) {
  const styles = isTeens ? teensStyles : kidsStyles;
  const elRef = useRef<HTMLButtonElement>(null);
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
        const droppedLeftId =
          typeof source.data?.leftId === 'string' ? source.data.leftId : undefined;
        if (droppedLeftId) {
          onDropLink(droppedLeftId);
        }
      },
    });
  }, [id, onDropLink]);

  return (
    <button
      ref={elRef}
      type="button"
      data-state={isPaired ? 'linked' : undefined}
      data-target={isOver || isTargetActive}
      className={`${styles.piece} ${styles.matchControl} w-full min-h-12 p-3 sm:p-4 rounded-2xl border-2 flex items-center justify-between text-left transition-all touch-manipulation cursor-pointer select-none ${
        isTeens
          ? ''
          : isOver
            ? 'border-indigo-500 ring-4 ring-indigo-300 bg-indigo-50 shadow-lg scale-102'
            : isTargetActive
              ? 'border-dashed border-amber-400 bg-amber-50/60 animate-pulse'
              : isPaired
                ? isKids
                  ? 'border-emerald-300 bg-emerald-50/60'
                  : 'border-emerald-600 bg-emerald-950/80'
                : isKids
                  ? 'border-amber-200/80 bg-white hover:border-amber-400 hover:shadow-xs'
                  : 'border-zinc-700 bg-zinc-800/80 hover:border-zinc-500'
      }`}
      onClick={onClickLink}
    >
      <span
        className={`text-sm font-bold ${
          isTeens
            ? isPaired
              ? 'text-[#166534]'
              : 'text-[#2B150A]'
            : isPaired
              ? isKids
                ? 'text-emerald-950'
                : 'text-emerald-100'
              : isKids
                ? 'text-zinc-900'
                : 'text-zinc-100'
        }`}
      >
        {text}
      </span>
      <span
        className={`text-xs font-bold ${isTeens ? 'text-[#5E3E2C] tabular-nums' : 'text-zinc-400'}`}
        aria-hidden="true"
      >
        {isTeens
          ? isPaired
            ? `Pareja ${pairNumber}`
            : isTargetActive
              ? 'Colocar aquí'
              : 'Disponible'
          : isPaired
            ? `🔗 ${pairNumber}`
            : isTargetActive
              ? '👈 Tocar aquí'
              : '🎯'}
      </span>
    </button>
  );
}

export default MatchGame;
