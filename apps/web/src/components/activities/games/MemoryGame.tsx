"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ActivityRuntimeProps,
  GamePublicConfig,
  GameAnswers,
  MemorySettingsSchema,
  MemorySolutionSchema,
  deterministicShuffle,
} from "@upward-english/shared";
import { soundManager } from "../../../lib/sound";

export function MemoryGame({
  config,
  initialState,
  theme = "kids",
  soundEnabled = true,
  previewMode = false,
  onEvent,
  onComplete,
}: ActivityRuntimeProps<GamePublicConfig, GameAnswers>) {
  const parsedSettings = MemorySettingsSchema.safeParse(config.settings);
  const settings = parsedSettings.success ? parsedSettings.data : null;
  const parsedSol = MemorySolutionSchema.safeParse(config.answerKey?.solution);
  const solution = parsedSol.success ? parsedSol.data : undefined;

  const originalCards = settings?.cards || [];

  // Deterministic shuffle of cards (RF-5, §4 Rule 5)
  const shuffledCards = useMemo(() => {
    const seed =
      originalCards.map((c) => c.id).join("-") +
      (solution?.pairs?.map((p) => p.join("-")).join("-") || "seed");
    return deterministicShuffle(originalCards, seed);
  }, [originalCards, solution]);

  const pairKey = (idA: string, idB: string) =>
    idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;

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
  const [liveStatus, setLiveStatus] = useState<string>("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const totalPairsCount = solution?.pairs
    ? solution.pairs.length
    : originalCards.length / 2;
  const foundPairsCount = resolvedCardIds.size / 2;

  const handleCardClick = (cardId: string) => {
    if (isLocked) return;
    if (resolvedCardIds.has(cardId)) return;
    if (activeFlippedIds.includes(cardId)) return;

    const clickedCard = shuffledCards.find((c) => c.id === cardId);

    if (activeFlippedIds.length === 0) {
      setActiveFlippedIds([cardId]);
      setLiveStatus(`Primera carta volteada: ${clickedCard?.text ?? ""}`);
      return;
    }

    if (activeFlippedIds.length === 1) {
      const firstCardId = activeFlippedIds[0]!;
      const firstCard = shuffledCards.find((c) => c.id === firstCardId);
      const currentTurn: [string, string] = [firstCardId, cardId];
      setActiveFlippedIds([firstCardId, cardId]);
      setIsLocked(true);

      const nextSelections = [...selections, currentTurn];
      setSelections(nextSelections);
      onEvent?.({ itemId: "selections", answer: nextSelections });

      const isMatch = expectedPairKeys.has(pairKey(firstCardId, cardId));

      if (isMatch) {
        soundManager.play("hit", soundEnabled);
        setIsLocked(false);
        setActiveFlippedIds([]);
        setLiveStatus(
          `¡Coincidencia correcta! Pareja de ${clickedCard?.text ?? ""} encontrada.`,
        );

        // Check if all pairs are now found
        if (foundPairsCount + 1 >= totalPairsCount) {
          soundManager.play("complete", soundEnabled);
          setLiveStatus("¡Felicitaciones! Has encontrado todas las parejas.");
        }
      } else {
        soundManager.play("miss", soundEnabled);
        setLiveStatus(
          `No coinciden: ${firstCard?.text ?? ""} y ${clickedCard?.text ?? ""}. Volteando cartas.`,
        );
        // Flip back after 900 ms (RF-5 Acceptance Criterion 2)
        timeoutRef.current = setTimeout(() => {
          setActiveFlippedIds([]);
          setIsLocked(false);
        }, 900);
      }
    }
  };

  const handleComplete = () => {
    soundManager.play("complete", soundEnabled);
    onComplete?.({ selections });
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

      {/* Grid of cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {shuffledCards.map((card) => {
          const isResolved = resolvedCardIds.has(card.id);
          const isTurnFlipped = activeFlippedIds.includes(card.id);
          const isFaceUp = isResolved || isTurnFlipped;
          const isInactive = isFaceUp || isLocked;

          return (
            <button
              key={card.id}
              type="button"
              aria-disabled={isInactive}
              onClick={() => {
                if (!isInactive) {
                  handleCardClick(card.id);
                }
              }}
              className={`min-h-24 sm:min-h-28 rounded-2xl p-3 border-2 font-black text-sm sm:text-base flex items-center justify-center text-center shadow-xs transition-colors touch-manipulation select-none focus-visible:outline-[var(--origami-focus)] ${
                isInactive ? "cursor-default" : "cursor-pointer"
              } ${
                isFaceUp
                  ? isResolved
                    ? "border-[var(--origami-success-text)] bg-[var(--origami-success-bg)] text-[var(--origami-success-text)] ring-2 ring-[var(--origami-focus)]"
                    : "origami-selected"
                  : isKids
                    ? "border-[var(--origami-border-control)] bg-[var(--origami-honey)] text-[var(--origami-on-honey)]"
                    : "border-[var(--origami-border-control)] bg-[var(--origami-surface-raised)] text-[var(--origami-text-secondary)] hover:bg-[var(--origami-surface-raised)]"
              }`}
              aria-label={isFaceUp ? card.text : "Tarjeta oculta"}
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
      <div className="pt-4 border-t border-[var(--origami-border-subtle)] flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--origami-text-secondary)]">
          Parejas encontradas: {foundPairsCount} de {totalPairsCount} · Turnos
          jugados: {selections.length}
        </p>

        <button
          type="button"
          onClick={handleComplete}
          className="origami-button"
        >
          Finalizar juego de memoria ✨
        </button>
      </div>
    </div>
  );
}

export default MemoryGame;
