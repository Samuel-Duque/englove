"use client";

import React, { useState } from "react";
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
} from "@upward-english/shared";

import { MatchGame } from "./games/MatchGame";
import { OrderWordsGame } from "./games/OrderWordsGame";
import { DragDropGame } from "./games/DragDropGame";
import { MemoryGame } from "./games/MemoryGame";
import { TimedChoiceGame } from "./games/TimedChoiceGame";
import { speak } from "../../lib/speech";

export interface SimulatedResult {
  score: number;
  stars: number;
  message: string;
}

export function GameRenderer(
  props: ActivityRuntimeProps<GamePublicConfig, GameAnswers>,
) {
  const { config, previewMode = false, onComplete } = props;
  const [simulatedResult, setSimulatedResult] =
    useState<SimulatedResult | null>(null);

  // In previewMode, simulate scoring in-memory without making network calls
  const handlePreviewComplete = (finalAnswers: GameAnswers) => {
    let fraction = 0;
    const mechanic = config.mechanic;
    const solution = config.answerKey?.solution;

    if (mechanic === GameMechanic.match && solution) {
      const parsedSol = MatchSolutionSchema.safeParse(solution);
      if (parsedSol.success) {
        fraction = calculateMatchScore(
          parsedSol.data.pairs,
          finalAnswers.pairs || {},
        );
      }
    } else if (mechanic === GameMechanic.order_words && solution) {
      const parsedSettings = OrderWordsSettingsSchema.safeParse(
        config.settings,
      );
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
    const ageSegment =
      props.theme === "teens" ? AgeSegment.teens : AgeSegment.kids;
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
          <div className="origami-state origami-state--error">
            Mecánica de juego no reconocida: {String(config?.mechanic)}
          </div>
        );
    }
  };

  const promptToSpeak = config.instructions || "";
  const [isPlayingTts, setIsPlayingTts] = useState(false);

  const handleSpeakPrompt = () => {
    if (
      !promptToSpeak ||
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    )
      return;
    setIsPlayingTts(true);
    speak(promptToSpeak, () => setIsPlayingTts(false));
  };

  return (
    <div className="w-full min-w-0 [overflow-wrap:anywhere]">
      {promptToSpeak && (
        <div className="origami-state mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="origami-label">{promptToSpeak}</p>
          <button
            type="button"
            onClick={handleSpeakPrompt}
            aria-label="Escuchar enunciado en inglés"
            className="origami-button origami-button--secondary"
          >
            <span>{isPlayingTts ? "🔊 Reproduciendo…" : "🔊 Escuchar"}</span>
          </button>
        </div>
      )}
      {previewMode && (
        <div className="mb-4 space-y-2">
          <div className="origami-state origami-state--warning">
            Modo de prueba — este intento no se guarda
          </div>
          {simulatedResult && (
            <div className="origami-state origami-state--success flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="origami-meta">Resultado de prueba:</p>
                <p className="text-base font-extrabold">
                  {simulatedResult.message}
                </p>
              </div>
              <div className="text-right">
                <div className="origami-label">
                  {"★".repeat(simulatedResult.stars) +
                    "☆".repeat(3 - simulatedResult.stars)}
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
