"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ActivityRuntimeProps,
  GamePublicConfig,
  GameAnswers,
  MatchSettingsSchema,
  MatchSolutionSchema,
  deterministicShuffle,
} from "@upward-english/shared";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { soundManager } from "../../../lib/sound";

export function MatchGame({
  config,
  initialState,
  theme = "kids",
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
    return (
      leftItems.map((l) => l.id).join("-") +
      (solution ? Object.values(solution.pairs || {}).join("-") : "seed")
    );
  }, [leftItems, solution]);

  const shuffledRight = useMemo(() => {
    let shuffled = deterministicShuffle(rightOriginal, seed);
    // Guarantee non-parallel permutation to left items if possible (SPEC-06 RF-2)
    if (
      solution?.pairs &&
      shuffled.length >= 2 &&
      leftItems.length === shuffled.length
    ) {
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
  const [liveStatus, setLiveStatus] = useState<string>("");

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

    const leftTxt = leftItems.find((l) => l.id === leftId)?.text ?? "";
    const rightTxt = shuffledRight.find((r) => r.id === rightId)?.text ?? "";
    setLiveStatus(`Pareja unida: ${leftTxt} con ${rightTxt}`);

    // Sound & feedback
    if (solution?.pairs) {
      const isCorrect = solution.pairs[leftId] === rightId;
      soundManager.play(isCorrect ? "hit" : "miss", soundEnabled);
    }

    onEvent?.({ itemId: "pairs", answer: next });
  };

  const handleUnlink = (leftId: string) => {
    const next = { ...pairs };
    delete next[leftId];
    setPairs(next);
    const leftTxt = leftItems.find((l) => l.id === leftId)?.text ?? "";
    setLiveStatus(`Pareja desvinculada para ${leftTxt}`);
    onEvent?.({ itemId: "pairs", answer: next });
  };

  const handleComplete = () => {
    soundManager.play("complete", soundEnabled);
    onComplete?.({ pairs });
  };

  const isKids = theme === "kids";

  return (
    <div className="w-full min-w-0 space-y-4 [overflow-wrap:anywhere]">
      {previewMode && (
        <div className="origami-state text-center">
          👀 Vista previa: no se guardan respuestas
        </div>
      )}

      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveStatus}
      </div>

      {config.instructions && (
        <div className="origami-state">
          <p className="text-sm sm:text-base font-semibold text-[var(--origami-text-primary)] leading-relaxed">
            {config.instructions}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-start">
        {/* Left Column */}
        <div className="space-y-3">
          <h4
            className={`text-xs font-extrabold uppercase tracking-wider ${
              isKids
                ? "text-[var(--origami-text-primary)]"
                : "text-[var(--origami-text-secondary)]"
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
              isKids
                ? "text-[var(--origami-text-primary)]"
                : "text-[var(--origami-text-secondary)]"
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
                  onDropLink={(droppedLeftId) =>
                    handleLink(droppedLeftId, item.id)
                  }
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
      <div className="mt-8 pt-4 border-t border-[var(--origami-border-subtle)] flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--origami-text-secondary)]">
          {Object.keys(pairs).length} de {leftItems.length} parejas formadas
        </p>

        <button
          type="button"
          onClick={handleComplete}
          className="origami-button"
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
      className={`min-h-[var(--origami-target)] p-2 sm:p-2.5 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-2 transition-colors touch-manipulation select-none ${
        isSelected
          ? "origami-selected"
          : isPaired
            ? "border-[var(--origami-success-text)] bg-[var(--origami-success-bg)]"
            : isKids
              ? "border-[var(--origami-border-control)] bg-[var(--origami-surface-raised)]  hover:shadow-xs"
              : "border-[var(--origami-border-control)] bg-[var(--origami-surface-raised)]"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        className="flex min-h-[var(--origami-target)] min-w-0 flex-1 flex-wrap items-center justify-between gap-2 p-1.5 text-left rounded-xl focus-visible:outline-[var(--origami-focus)]"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{text}</span>
          {isPaired && pairedText && (
            <span className="text-xs font-semibold text-[var(--origami-success-text)] bg-[var(--origami-success-bg)] px-2 py-0.5 rounded-lg">
              🔗 {pairedText}
            </span>
          )}
        </div>
        <span className="text-xs font-bold mr-1" aria-hidden="true">
          {isSelected ? "✓ Activo" : "👉"}
        </span>
      </button>

      {isPaired && (
        <button
          type="button"
          onClick={onUnlink}
          className="origami-button origami-button--text !p-1"
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
        const droppedLeftId =
          typeof source.data?.leftId === "string"
            ? source.data.leftId
            : undefined;
        if (droppedLeftId) {
          onDropLink(droppedLeftId);
        }
      },
    });
  }, [id, onDropLink]);

  return (
    <div
      ref={elRef}
      className={`min-h-[var(--origami-target)] p-3 sm:p-4 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-2 transition-colors touch-manipulation cursor-pointer select-none ${
        isOver
          ? "border-[var(--origami-paper-blue)] ring-4 ring-[var(--origami-focus)] bg-[var(--origami-info-bg)] text-[var(--origami-info-text)]"
          : isTargetActive
            ? "border-dashed border-[var(--origami-border-control)] bg-[var(--origami-surface-soft)]"
            : isPaired
              ? "border-[var(--origami-success-text)] bg-[var(--origami-success-bg)]"
              : isKids
                ? "border-[var(--origami-border-control)] bg-[var(--origami-surface-raised)]  hover:shadow-xs"
                : "border-[var(--origami-border-control)] bg-[var(--origami-surface-raised)]"
      }`}
      role="button"
      tabIndex={0}
      onClick={onClickLink}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClickLink();
        }
      }}
    >
      <span
        className={`text-sm font-bold ${
          isPaired
            ? "text-[var(--origami-success-text)]"
            : "text-[var(--origami-text-primary)]"
        }`}
      >
        {text}
      </span>
      <span
        className="text-xs text-[var(--origami-text-secondary)] font-bold"
        aria-hidden="true"
      >
        {isPaired ? "✅" : isTargetActive ? "👈 Tocar aquí" : "🎯"}
      </span>
    </div>
  );
}

export default MatchGame;
