"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ActivityRuntimeProps,
  GamePublicConfig,
  GameAnswers,
  OrderWordsSettingsSchema,
  OrderWordsSolutionSchema,
  deterministicShuffle,
} from "@upward-english/shared";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { soundManager } from "../../../lib/sound";

export function OrderWordsGame({
  config,
  initialState,
  theme = "kids",
  soundEnabled = true,
  previewMode = false,
  onEvent,
  onComplete,
}: ActivityRuntimeProps<GamePublicConfig, GameAnswers>) {
  const parsedSettings = OrderWordsSettingsSchema.safeParse(config.settings);
  const settings = parsedSettings.success ? parsedSettings.data : null;
  const parsedSol = OrderWordsSolutionSchema.safeParse(
    config.answerKey?.solution,
  );
  const solution = parsedSol.success ? parsedSol.data : undefined;

  const originalTokens = settings?.tokens || [];

  // Deterministic bank shuffle (RF-3, §4 Rule 5)
  const initialBankTokens = useMemo(() => {
    const seed =
      originalTokens.map((t) => t.id).join("-") +
      (solution?.tokenIds?.join("-") || "seed");
    let shuffled = deterministicShuffle(originalTokens, seed);

    // If shuffled order matches solution, reverse or rotate to guarantee difference
    if (solution?.tokenIds && shuffled.length >= 2) {
      const shuffledIds = shuffled.map((t) => t.id);
      const isIdentical = shuffledIds.every(
        (id, idx) => id === solution.tokenIds[idx],
      );
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
  const [liveStatus, setLiveStatus] = useState<string>("");

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
    const tok = tokenMap.get(tokenId);
    setLiveStatus(`Palabra ${tok?.text ?? ""} añadida a la oración`);
    onEvent?.({ itemId: "tokenIds", answer: next });
  };

  const handleInsertBankToken = (tokenId: string, atIndex: number) => {
    if (tokenIds.includes(tokenId)) return;
    const next = [...tokenIds];
    next.splice(atIndex, 0, tokenId);
    setTokenIds(next);
    const tok = tokenMap.get(tokenId);
    setLiveStatus(
      `Palabra ${tok?.text ?? ""} insertada en la posición ${atIndex + 1}`,
    );
    onEvent?.({ itemId: "tokenIds", answer: next });
  };

  const handleRemoveToken = (tokenId: string) => {
    const next = tokenIds.filter((id) => id !== tokenId);
    setTokenIds(next);
    const tok = tokenMap.get(tokenId);
    setLiveStatus(`Palabra ${tok?.text ?? ""} devuelta al banco`);
    onEvent?.({ itemId: "tokenIds", answer: next });
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
      const tok = tokenMap.get(moved);
      setLiveStatus(
        `Palabra ${tok?.text ?? ""} movida a la posición ${toIndex + 1}`,
      );
      onEvent?.({ itemId: "tokenIds", answer: next });
    }
  };

  const handleComplete = () => {
    soundManager.play("complete", soundEnabled);
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
        if (data?.type === "bank-token" && typeof data.tokenId === "string") {
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
        if (data?.type === "placed-token" && typeof data.tokenId === "string") {
          handleRemoveToken(data.tokenId);
        }
      },
    });
  }, [tokenIds]);

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

      {/* Sentence Construction Line */}
      <div className="space-y-2 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4
            className={`text-xs font-extrabold uppercase tracking-wider ${
              isKids
                ? "text-[var(--origami-text-primary)]"
                : "text-[var(--origami-text-secondary)]"
            }`}
          >
            Línea de construcción de oración:
          </h4>
          <span className="text-xs font-semibold text-[var(--origami-text-secondary)]">
            {tokenIds.length} de {originalTokens.length} palabras
          </span>
        </div>

        <div
          ref={sentenceLineRef}
          className={`min-h-24 p-4 rounded-2xl border-2 border-dashed flex flex-wrap items-center gap-2.5 transition-colors ${
            isOverLine
              ? "border-[var(--origami-paper-blue)] ring-4 ring-[var(--origami-focus)] bg-[var(--origami-info-bg)] shadow-md"
              : tokenIds.length === 0
                ? isKids
                  ? "border-[var(--origami-border-control)] bg-[var(--origami-surface-soft)] justify-center"
                  : "border-[var(--origami-border-control)] bg-[var(--origami-surface-raised)] justify-center"
                : "border-[var(--origami-border-control)] bg-[var(--origami-surface-raised)] shadow-inner"
          }`}
        >
          {tokenIds.length === 0 ? (
            <p
              className={`text-xs sm:text-sm font-semibold text-center select-none ${
                isKids
                  ? "text-[var(--origami-text-primary)] font-medium"
                  : "text-[var(--origami-text-secondary)]"
              }`}
            >
              Arrastra o toca palabras del banco hacia aquí para construir la
              frase.
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
            isKids
              ? "text-[var(--origami-text-primary)]"
              : "text-[var(--origami-text-secondary)]"
          }`}
        >
          Banco de palabras:
        </h4>

        <div
          ref={bankRef}
          className={`flex flex-wrap gap-2.5 p-4 rounded-2xl border min-h-16 items-center transition-colors ${
            isOverBank
              ? "border-[var(--origami-error-text)] ring-4 ring-[var(--origami-focus)] bg-[var(--origami-error-bg)]"
              : "bg-[var(--origami-surface-raised)] border-[var(--origami-border-control)]"
          }`}
        >
          {bankTokens.length === 0 ? (
            <p className="text-xs font-medium text-[var(--origami-text-secondary)] italic">
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
      <div className="pt-4 border-t border-[var(--origami-border-subtle)] flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setTokenIds([]);
            onEvent?.({ itemId: "tokenIds", answer: [] });
          }}
          disabled={tokenIds.length === 0}
          className="origami-button origami-button--text"
        >
          Reiniciar orden
        </button>

        <button
          type="button"
          onClick={handleComplete}
          className="origami-button"
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
      getInitialData: () => ({ type: "bank-token", tokenId: id }),
    });
  }, [id]);

  return (
    <button
      ref={elRef}
      type="button"
      onClick={() => onAddToken(id)}
      className={`min-h-[var(--origami-target)] min-w-12 px-4 py-2.5 rounded-2xl font-black text-sm border-2 shadow-xs transition-colors touch-manipulation cursor-grab ${
        isKids
          ? "border-[var(--origami-border-control)] bg-[var(--origami-surface-soft)] text-[var(--origami-text-primary)] hover:bg-[var(--origami-surface-soft)]"
          : "border-[var(--origami-border-control)] bg-[var(--origami-surface-raised)] text-[var(--origami-text-primary)] hover:bg-[var(--origami-surface-raised)]"
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
      getInitialData: () => ({ type: "placed-token", index, tokenId: id }),
    });

    const cleanupDropTarget = dropTargetForElements({
      element: el,
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: ({ source }) => {
        setIsOver(false);
        const data = source.data;
        if (data?.type === "placed-token" && typeof data.index === "number") {
          onMoveToken(data.index, index);
        } else if (
          data?.type === "bank-token" &&
          typeof data.tokenId === "string"
        ) {
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
      className={`group inline-flex items-center gap-1 rounded-xl border px-3 py-2 shadow-xs transition-colors cursor-grab ${
        isOver ? "ring-2 ring-[var(--origami-focus)]" : ""
      } ${
        isKids
          ? "bg-[var(--origami-surface-soft)] border-[var(--origami-border-control)]"
          : "bg-[var(--origami-surface-raised)] border-[var(--origami-border-control)]"
      }`}
    >
      <span className="text-xs font-mono font-bold mr-1 select-none text-[var(--origami-text-secondary)]">
        #{index + 1}
      </span>
      <span className="text-sm sm:text-base font-extrabold text-[var(--origami-text-primary)]">
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
          className="origami-button origami-button--text !p-1"
          title="Mover a la izquierda"
          aria-label={`Mover ${text} a la izquierda`}
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
          className="origami-button origami-button--text !p-1"
          title="Mover a la derecha"
          aria-label={`Mover ${text} a la derecha`}
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
        className="origami-button origami-button--text !p-1"
        title="Devolver al banco"
        aria-label={`Devolver ${text} al banco`}
      >
        ✕
      </button>
    </div>
  );
}

export default OrderWordsGame;
