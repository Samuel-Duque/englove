'use client';

import React, { useState, useEffect } from 'react';
import {
  ActivityRuntimeProps,
  GamePublicConfig,
  GameAnswers,
  GameMechanic,
  calculateMatchScore,
  calculateOrderWordsScore,
  calculateDragDropScore,
  calculateTimedChoiceScore,
  reconstructMemoryPlays,
  scoreToStars,
  MatchSolution,
  OrderWordsSettings,
  OrderWordsSolution,
  DragDropSolution,
  MemorySettings,
  MemorySolution,
  TimedChoiceSolution,
} from '@englove/shared';

import { MatchGame } from './games/MatchGame';
import { OrderWordsGame } from './games/OrderWordsGame';
import { DragDropGame } from './games/DragDropGame';
import { MemoryGame } from './games/MemoryGame';
import { TimedChoiceGame } from './games/TimedChoiceGame';
import { loadMotionTheme } from '../../lib/motion';

export interface SimulatedResult {
  score: number;
  stars: number;
  message: string;
}

export function GameRenderer(props: ActivityRuntimeProps<GamePublicConfig, GameAnswers>) {
  const { config, previewMode = false, onComplete } = props;
  const [simulatedResult, setSimulatedResult] = useState<SimulatedResult | null>(null);

  // Dynamic chunk loading of age-specific motion presets (RF-10, ENG-086)
  useEffect(() => {
    void loadMotionTheme(props.theme || 'kids');
  }, [props.theme]);

  // In previewMode, simulate scoring in-memory without making network calls
  const handlePreviewComplete = (finalAnswers: GameAnswers) => {
    let fraction = 0;
    const mechanic = config.mechanic;
    const solution = config.answerKey?.solution;

    if (mechanic === GameMechanic.match && solution) {
      fraction = calculateMatchScore((solution as MatchSolution).pairs, finalAnswers.pairs || {});
    } else if (mechanic === GameMechanic.order_words && solution) {
      const settings = config.settings as OrderWordsSettings;
      fraction = calculateOrderWordsScore(
        settings.tokens,
        (solution as OrderWordsSolution).tokenIds,
        finalAnswers.tokenIds || [],
      );
    } else if (mechanic === GameMechanic.drag_drop && solution) {
      fraction = calculateDragDropScore(
        (solution as DragDropSolution).placements,
        finalAnswers.placements || {},
      );
    } else if (mechanic === GameMechanic.memory && solution) {
      const settings = config.settings as MemorySettings;
      const recon = reconstructMemoryPlays(
        settings.cards,
        (solution as MemorySolution).pairs,
        finalAnswers.selections || [],
      );
      fraction = recon.fraction;
    } else if (mechanic === GameMechanic.timed_choice && solution) {
      fraction = calculateTimedChoiceScore(
        (solution as TimedChoiceSolution).choices,
        finalAnswers.choices || {},
      );
    }

    const score = Math.round(fraction * 5 * 10) / 10;
    const stars = scoreToStars(score);

    setSimulatedResult({
      score,
      stars,
      message:
        score >= 3.0
          ? '¡Excelente partida simulada!'
          : 'Partida completada. Modo previsualización.',
    });

    onComplete?.(finalAnswers);
  };

  const runtimeProps: ActivityRuntimeProps<GamePublicConfig, GameAnswers> = {
    ...props,
    onComplete: previewMode ? handlePreviewComplete : onComplete,
  };

  const renderGame = () => {
    switch (config.mechanic) {
      case GameMechanic.match:
        return <MatchGame {...runtimeProps} />;
      case GameMechanic.order_words:
        return <OrderWordsGame {...runtimeProps} />;
      case GameMechanic.drag_drop:
        return <DragDropGame {...runtimeProps} />;
      case GameMechanic.memory:
        return <MemoryGame {...runtimeProps} />;
      case GameMechanic.timed_choice:
        return <TimedChoiceGame {...runtimeProps} />;
      default:
        return (
          <div className="p-8 text-center text-zinc-500 font-semibold">
            Mecánica de juego no reconocida: {(config as { mechanic?: string })?.mechanic}
          </div>
        );
    }
  };

  return (
    <div className="w-full">
      {previewMode && (
        <div className="mb-4 space-y-2">
          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold text-center shadow-xs">
            👀 Vista previa: no se guardan respuestas (0 llamadas a la API)
          </div>
          {simulatedResult && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-center justify-between shadow-xs">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-800">
                  Resultado simulado en memoria:
                </p>
                <p className="text-base font-extrabold">{simulatedResult.message}</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black">{simulatedResult.score.toFixed(1)} / 5.0</span>
                <div className="text-amber-500 text-lg">
                  {'⭐'.repeat(simulatedResult.stars)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {renderGame()}
    </div>
  );
}

export default GameRenderer;
