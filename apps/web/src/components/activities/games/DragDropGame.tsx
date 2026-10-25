'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ActivityRuntimeProps,
  GamePublicConfig,
  GameAnswers,
  DragDropSettings,
  DragDropSolution,
  deterministicShuffle,
} from '@englove/shared';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { soundManager } from '../../../lib/sound';

export function DragDropGame({
  config,
  initialState,
  theme = 'kids',
  soundEnabled = true,
  previewMode = false,
  onEvent,
  onComplete,
}: ActivityRuntimeProps<GamePublicConfig, GameAnswers>) {
  const settings = config.settings as DragDropSettings;
  const solution = config.answerKey?.solution as DragDropSolution | undefined;

  const originalObjects = settings?.objects || [];
  const targets = settings?.targets || [];

  // Deterministic shuffle of objects (RF-4, §4 Rule 5)
  const initialObjects = useMemo(() => {
    const seed = originalObjects.map((o) => o.id).join('-') + (targets.map((t) => t.id).join('-'));
    return deterministicShuffle(originalObjects, seed);
  }, [originalObjects, targets]);

  const [placements, setPlacements] = useState<Record<string, string>>(() => {
    return initialState?.placements ? { ...initialState.placements } : {};
  });

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const objectMap = useMemo(() => {
    const map = new Map<string, { id: string; text: string }>();
    for (const obj of originalObjects) {
      map.set(obj.id, obj);
    }
    return map;
  }, [originalObjects]);

  // Objects placed in each target
  const objectsInTarget = useMemo(() => {
    const map = new Map<string, Array<{ id: string; text: string }>>();
    for (const t of targets) {
      map.set(t.id, []);
    }
    for (const [objId, targetId] of Object.entries(placements)) {
      const obj = objectMap.get(objId);
      if (obj && map.has(targetId)) {
        map.get(targetId)!.push(obj);
      }
    }
    return map;
  }, [placements, targets, objectMap]);

  // Unplaced objects still in the tray
  const trayObjects = useMemo(() => {
    return initialObjects.filter((obj) => !placements[obj.id]);
  }, [initialObjects, placements]);

  const handlePlace = (objectId: string, targetId: string) => {
    setPlacements((prev) => {
      const next = { ...prev, [objectId]: targetId };
      onEvent?.({ itemId: 'placements', answer: next });

      if (solution?.placements) {
        const isCorrect = solution.placements[objectId] === targetId;
        soundManager.play(isCorrect ? 'hit' : 'miss', soundEnabled);
      }
      return next;
    });
    setSelectedObjectId(null);
  };

  const handleReturnToTray = (objectId: string) => {
    setPlacements((prev) => {
      const next = { ...prev };
      delete next[objectId];
      onEvent?.({ itemId: 'placements', answer: next });
      return next;
    });
    if (selectedObjectId === objectId) setSelectedObjectId(null);
  };

  const handleComplete = () => {
    soundManager.play('complete', soundEnabled);
    onComplete?.({ placements });
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

      {/* Target Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {targets.map((target) => {
          const placedInThis = objectsInTarget.get(target.id) || [];
          const isTargetActive = Boolean(selectedObjectId);

          return (
            <TargetCategoryContainer
              key={target.id}
              id={target.id}
              name={target.text}
              placedObjects={placedInThis}
              isKids={isKids}
              isTargetActive={isTargetActive}
              onDropObject={(objId) => handlePlace(objId, target.id)}
              onClickCategory={() => {
                if (selectedObjectId) {
                  handlePlace(selectedObjectId, target.id);
                }
              }}
              onRemoveObject={(objId) => handleReturnToTray(objId)}
              onSelectObject={(objId) => setSelectedObjectId(objId)}
              selectedObjectId={selectedObjectId}
            />
          );
        })}
      </div>

      {/* Objects Tray */}
      <div className="space-y-3 mb-8">
        <div className="flex items-center justify-between">
          <h4
            className={`text-xs font-extrabold uppercase tracking-wider ${
              isKids ? 'text-amber-800' : 'text-zinc-400'
            }`}
          >
            Bandeja de objetos ({trayObjects.length} disponibles)
          </h4>
          {selectedObjectId && (
            <span className="text-xs font-bold text-amber-700 animate-pulse">
              Seleccionado: {objectMap.get(selectedObjectId)?.text} — Elige una categoría arriba
            </span>
          )}
        </div>

        <div
          className={`min-h-20 p-4 rounded-2xl border-2 border-dashed flex flex-wrap gap-2.5 items-center transition-colors ${
            selectedObjectId
              ? 'border-amber-400 bg-amber-100/50'
              : 'border-amber-200/90 bg-white/70'
          }`}
        >
          {trayObjects.length === 0 ? (
            <p className="text-xs font-medium text-zinc-400 italic">
              Todos los objetos están colocados en las categorías.
            </p>
          ) : (
            trayObjects.map((obj) => (
              <DraggableObjectToken
                key={obj.id}
                id={obj.id}
                text={obj.text}
                isSelected={selectedObjectId === obj.id}
                isKids={isKids}
                onSelect={() => {
                  if (selectedObjectId === obj.id) {
                    setSelectedObjectId(null);
                  } else {
                    setSelectedObjectId(obj.id);
                  }
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-amber-200/60 flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-500">
          {Object.keys(placements).length} de {originalObjects.length} clasificados
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
          Finalizar clasificación ✨
        </button>
      </div>
    </div>
  );
}

function DraggableObjectToken({
  id,
  text,
  isSelected,
  isKids,
  onSelect,
}: {
  id: string;
  text: string;
  isSelected: boolean;
  isKids: boolean;
  onSelect: () => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    return draggable({
      element: el,
      getInitialData: () => ({ objectId: id }),
    });
  }, [id]);

  return (
    <div
      ref={elRef}
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
      className={`min-h-12 min-w-12 px-4 py-2.5 rounded-2xl font-black text-sm border-2 shadow-xs transition-all touch-manipulation cursor-pointer flex items-center gap-1.5 ${
        isSelected
          ? 'border-amber-500 ring-4 ring-amber-300 bg-amber-300 text-amber-950 scale-105'
          : isKids
            ? 'border-amber-300 bg-white text-amber-950 hover:bg-amber-100 hover:border-amber-400'
            : 'border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
      }`}
    >
      <span>📦</span>
      <span>{text}</span>
    </div>
  );
}

function TargetCategoryContainer({
  id,
  name,
  placedObjects,
  isKids,
  isTargetActive,
  onDropObject,
  onClickCategory,
  onRemoveObject,
  onSelectObject,
  selectedObjectId,
}: {
  id: string;
  name: string;
  placedObjects: Array<{ id: string; text: string }>;
  isKids: boolean;
  isTargetActive: boolean;
  onDropObject: (objectId: string) => void;
  onClickCategory: () => void;
  onRemoveObject: (objectId: string) => void;
  onSelectObject: (objectId: string) => void;
  selectedObjectId: string | null;
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
        const objId = source.data?.objectId as string | undefined;
        if (objId) onDropObject(objId);
      },
    });
  }, [id, onDropObject]);

  return (
    <div
      ref={elRef}
      role="button"
      tabIndex={0}
      aria-label={`Categoría ${name}. ${placedObjects.length} ítems`}
      onClick={onClickCategory}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClickCategory();
        }
      }}
      className={`min-h-36 p-4 rounded-3xl border-2 flex flex-col justify-between transition-all touch-manipulation cursor-pointer ${
        isOver
          ? 'border-indigo-500 ring-4 ring-indigo-300 bg-indigo-50 shadow-lg'
          : isTargetActive
            ? 'border-dashed border-amber-400 bg-amber-100/50 animate-pulse'
            : isKids
              ? 'border-amber-300/80 bg-white shadow-xs'
              : 'border-zinc-700 bg-zinc-800'
      }`}
    >
      <div>
        <div className={`flex items-center justify-between pb-2 border-b ${
          isKids ? 'border-zinc-100' : 'border-zinc-700'
        }`}>
          <span className={`text-sm font-black ${isKids ? 'text-zinc-900' : 'text-zinc-100'}`}>{name}</span>
          <span className="text-xs font-bold text-zinc-400">
            {placedObjects.length} ítems
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-3">
          {placedObjects.map((obj) => (
            <div
              key={obj.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectObject(obj.id);
              }}
              className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-extrabold shadow-2xs border ${
                selectedObjectId === obj.id
                  ? 'border-amber-500 ring-2 ring-amber-400 bg-amber-200'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-950'
              }`}
            >
              <span>{obj.text}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveObject(obj.id);
                }}
                className="text-rose-600 hover:text-rose-800 font-black ml-1"
                title="Devolver a la bandeja"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 text-right">
        <span className="text-2xs font-bold text-zinc-400">
          {isTargetActive ? '👈 Tocar para colocar aquí' : '📥 Arrastra aquí'}
        </span>
      </div>
    </div>
  );
}

export default DragDropGame;
