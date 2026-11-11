'use client';

import React, { useState } from 'react';
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
  scoreToGameStars,
  getGameMotivationMessage,
  AgeSegment,
  MatchSolutionSchema,
  OrderWordsSettingsSchema,
  OrderWordsSolutionSchema,
  DragDropSolutionSchema,
  MemorySettingsSchema,
  MemorySolutionSchema,
  TimedChoiceSolutionSchema,
} from '@englove/shared';

import { MatchGame } from './games/MatchGame';
import { OrderWordsGame } from './games/OrderWordsGame';
import { DragDropGame } from './games/DragDropGame';
import { MemoryGame } from './games/MemoryGame';
import { TimedChoiceGame } from './games/TimedChoiceGame';

export interface SimulatedResult {
  score: number;
  stars: number;
  message: string;
}

export function GameRenderer(props: ActivityRuntimeProps<GamePublicConfig, GameAnswers>) {
  const { config, previewMode = false, onComplete } = props;
  const [simulatedResult, setSimulatedResult] = useState<SimulatedResult | null>(null);

  // In previewMode, simulate scoring in-memory without making network calls
  const handlePreviewComplete = (finalAnswers: GameAnswers) => {
    let fraction = 0;
    const mechanic = config.mechanic;
    const solution = config.answerKey?.solution;

    if (mechanic === GameMechanic.match && solution) {
      const parsedSol = MatchSolutionSchema.safeParse(solution);
      if (parsedSol.success) {
        fraction = calculateMatchScore(parsedSol.data.pairs, finalAnswers.pairs || {});
      }
    } else if (mechanic === GameMechanic.order_words && solution) {
      const parsedSettings = OrderWordsSettingsSchema.safeParse(config.settings);
      const parsedSol = OrderWordsSolutionSchema.safeParse(solution);
      if (parsedSettings.success && parsedSol.success) {
        fraction = calculateOrderWordsScore(
          parsedSettings.data.tokens,
          parsedSol.data.tokenIds,
          finalAnswers.tokenIds || [],
        );
      }
    } else if (mechanic === GameMechanic.drag_drop && solution) {
      const parsedSol = DragDropSolutionSchema.safeParse(solution);
      if (parsedSol.success) {
        fraction = calculateDragDropScore(
          parsedSol.data.placements,
          finalAnswers.placements || {},
        );
      }
    } else if (mechanic === GameMechanic.memory && solution) {
      const parsedSettings = MemorySettingsSchema.safeParse(config.settings);
      const parsedSol = MemorySolutionSchema.safeParse(solution);
      if (parsedSettings.success && parsedSol.success) {
        const recon = reconstructMemoryPlays(
          parsedSettings.data.cards,
          parsedSol.data.pairs,
          finalAnswers.selections || [],
        );
        fraction = recon.fraction;
      }
    } else if (mechanic === GameMechanic.timed_choice && solution) {
      const parsedSol = TimedChoiceSolutionSchema.safeParse(solution);
      if (parsedSol.success) {
        fraction = calculateTimedChoiceScore(
          parsedSol.data.choices,
          finalAnswers.choices || {},
        );
      }
    }

    const score = Math.round(fraction * 5 * 10) / 10;
    const stars = scoreToGameStars(score);
    const ageSegment = props.theme === 'teens' ? AgeSegment.teens : AgeSegment.kids;
    const message = getGameMotivationMessage(score, ageSegment);

    setSimulatedResult({
      score,
      stars,
      message,
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
            Mecánica de juego no reconocida: {String(config?.mechanic)}
          </div>
        );
    }
  };

  const promptToSpeak = config.instructions || '';
  const [isPlayingTts, setIsPlayingTts] = useState(false);

  const handleSpeakPrompt = () => {
    if (!promptToSpeak || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(promptToSpeak);
    utterance.lang = 'en-US';
    utterance.onend = () => setIsPlayingTts(false);
    utterance.onerror = () => setIsPlayingTts(false);
    setIsPlayingTts(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="w-full">
      {promptToSpeak && (
        <div className="mb-4 flex items-center justify-between gap-3 p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200/80">
          <p className="text-sm font-bold text-amber-950">{promptToSpeak}</p>
          <button
            type="button"
            onClick={handleSpeakPrompt}
            aria-label="Escuchar enunciado en inglés"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-xs shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <span>{isPlayingTts ? '🔊 Reproduciendo…' : '🔊 Escuchar'}</span>
          </button>
        </div>
      )}
      {previewMode && (
        <div className="mb-4 space-y-2">
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold text-center shadow-xs">
            Modo de prueba — este intento no se guarda
          </div>
          {simulatedResult && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-center justify-between shadow-xs">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-800">
                  Resultado de prueba:
                </p>
                <p className="text-base font-extrabold">{simulatedResult.message}</p>
              </div>
              <div className="text-right">
                <div className="text-amber-500 text-xl font-bold">
                  {'★'.repeat(simulatedResult.stars) + '☆'.repeat(3 - simulatedResult.stars)}
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
