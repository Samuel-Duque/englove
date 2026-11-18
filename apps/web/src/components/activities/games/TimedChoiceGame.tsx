"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ActivityRuntimeProps,
  GamePublicConfig,
  GameAnswers,
  TimedChoiceSettingsSchema,
  TimedChoiceSolutionSchema,
} from "@upward-english/shared";
import { soundManager } from "../../../lib/sound";

export function TimedChoiceGame({
  config,
  theme = "kids",
  soundEnabled = true,
  previewMode = false,
  onEvent,
  onComplete,
}: ActivityRuntimeProps<GamePublicConfig, GameAnswers>) {
  const parsedSettings = TimedChoiceSettingsSchema.safeParse(config.settings);
  const settings = parsedSettings.success ? parsedSettings.data : null;
  const parsedSol = TimedChoiceSolutionSchema.safeParse(
    config.answerKey?.solution,
  );
  const solution = parsedSol.success ? parsedSol.data : undefined;

  const questions = settings?.questions || [];
  const timeLimitSeconds = settings?.timeLimitSeconds || 20;

  // Decision 106: Always start at question index 0 with choices = {} and full timer
  const [currentIndex, setCurrentIndex] = useState(0);
  const [choices, setChoices] = useState<Record<string, string | null>>({});
  const [secondsLeft, setSecondsLeft] = useState(timeLimitSeconds);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [isWaitingFeedback, setIsWaitingFeedback] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string>("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentQuestion = questions[currentIndex];
  const expectedOptionId =
    currentQuestion && solution?.choices
      ? solution.choices[currentQuestion.id]
      : null;

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  // Decision 106: Always reset choices in attempt payload on initial mount
  useEffect(() => {
    onEvent?.({ itemId: "choices", answer: {} });
  }, []);

  // Countdown timer for each question
  useEffect(() => {
    if (isWaitingFeedback || !currentQuestion) return;

    setSecondsLeft(timeLimitSeconds);
    setSelectedOptionId(null);
    setIsTimedOut(false);
    setLiveStatus(
      `Pregunta ${currentIndex + 1} de ${questions.length}: ${currentQuestion.prompt}`,
    );

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setTimeout(() => handleTimeExpired(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, isWaitingFeedback]);

  // Handle countdown expiration
  const handleTimeExpired = () => {
    if (!currentQuestion || isWaitingFeedback) return;

    setIsTimedOut(true);
    setIsWaitingFeedback(true);
    setLiveStatus("Se agotó el tiempo para esta pregunta.");
    soundManager.play("miss", soundEnabled);

    const nextChoices = { ...choices, [currentQuestion.id]: null };
    setChoices(nextChoices);
    onEvent?.({ itemId: "choices", answer: nextChoices });

    // Show feedback for 800 ms then advance
    feedbackTimeoutRef.current = setTimeout(() => {
      advanceOrComplete(nextChoices);
    }, 800);
  };

  const handleSelectOption = (optionId: string) => {
    if (isWaitingFeedback || !currentQuestion) return;

    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedOptionId(optionId);
    setIsWaitingFeedback(true);

    const isCorrect = expectedOptionId ? expectedOptionId === optionId : false;
    const opt = currentQuestion.options.find((o) => o.id === optionId);
    setLiveStatus(
      isCorrect
        ? `¡Correcto! Seleccionaste: ${opt?.text ?? ""}`
        : `Incorrecto. Seleccionaste: ${opt?.text ?? ""}`,
    );
    soundManager.play(isCorrect ? "hit" : "miss", soundEnabled);

    const nextChoices = { ...choices, [currentQuestion.id]: optionId };
    setChoices(nextChoices);
    onEvent?.({ itemId: "choices", answer: nextChoices });

    // Feedback duration: 800 ms (RF-6 Acceptance Criterion 1)
    feedbackTimeoutRef.current = setTimeout(() => {
      advanceOrComplete(nextChoices);
    }, 800);
  };

  const advanceOrComplete = (finalChoices: Record<string, string | null>) => {
    setIsWaitingFeedback(false);
    setSelectedOptionId(null);
    setIsTimedOut(false);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      soundManager.play("complete", soundEnabled);
      onComplete?.({ choices: finalChoices });
    }
  };

  const isKids = theme === "kids";

  if (!currentQuestion) {
    return (
      <div className="p-8 text-center text-[var(--origami-text-secondary)] font-semibold">
        No hay preguntas disponibles en este microjuego.
      </div>
    );
  }

  const progressPercent = ((currentIndex + 1) / questions.length) * 100;

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

      {/* Progress & Countdown Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-[var(--origami-text-primary)]">
            Pregunta {currentIndex + 1} de {questions.length}
          </span>
          <div className="w-24 sm:w-44 h-2 bg-[var(--origami-surface-soft)] rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-[var(--origami-primary)] rounded-full transition-colors"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Timer Badge */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border-2 font-mono font-black text-sm transition-colors ${
              secondsLeft <= 5
                ? "border-[var(--origami-error-text)] bg-[var(--origami-error-bg)] text-[var(--origami-error-text)]"
                : "border-[var(--origami-border-control)] bg-[var(--origami-surface-raised)] text-[var(--origami-text-primary)]"
            }`}
          >
            <span>⏱️</span>
            <span>{secondsLeft}s</span>
          </div>
        </div>
      </div>

      {/* Question Prompt */}
      <div className="origami-card text-center">
        <h3 className="origami-card-title">{currentQuestion.prompt}</h3>
      </div>

      {/* Options List */}
      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((opt) => {
          const isSelected = selectedOptionId === opt.id;
          const isExpected = expectedOptionId === opt.id;

          let btnStyle = isKids
            ? "border-[var(--origami-border-control)] bg-[var(--origami-surface-raised)] text-[var(--origami-text-primary)]  hover:bg-[var(--origami-surface-soft)]"
            : "border-[var(--origami-border-control)] bg-[var(--origami-surface-raised)] text-[var(--origami-text-primary)]";

          if (isWaitingFeedback) {
            if (isSelected) {
              btnStyle = isExpected
                ? "border-[var(--origami-success-text)] bg-[var(--origami-success-bg)] text-[var(--origami-success-text)] ring-4 ring-[var(--origami-focus)] font-black"
                : "border-[var(--origami-error-text)] bg-[var(--origami-error-bg)] text-[var(--origami-error-text)] ring-4 ring-[var(--origami-focus)] font-black";
            } else if (isExpected && (isSelected || isTimedOut)) {
              btnStyle =
                "border-[var(--origami-success-text)] bg-[var(--origami-success-bg)] text-[var(--origami-success-text)] ring-2 ring-[var(--origami-focus)] font-black";
            }
          }

          return (
            <button
              key={opt.id}
              type="button"
              aria-disabled={isWaitingFeedback}
              onClick={() => {
                if (!isWaitingFeedback) {
                  handleSelectOption(opt.id);
                }
              }}
              className={`w-full min-h-[var(--origami-button-height)] p-4 rounded-2xl border-2 font-bold text-base flex flex-wrap items-center justify-between gap-2 text-left transition-colors touch-manipulation select-none shadow-xs focus-visible:outline-[var(--origami-focus)] ${
                isWaitingFeedback ? "cursor-default" : "cursor-pointer"
              } ${btnStyle}`}
            >
              <span>{opt.text}</span>
              <span className="text-xs font-black" aria-hidden="true">
                {isWaitingFeedback && isSelected
                  ? isExpected
                    ? "✅ Correcto"
                    : "❌ Incorrecto"
                  : isWaitingFeedback && isExpected && isTimedOut
                    ? "👈 Correcta"
                    : "👉"}
              </span>
            </button>
          );
        })}
      </div>

      {isTimedOut && (
        <p className="text-center text-xs font-bold text-[var(--origami-error-text)]">
          ¡Se acabó el tiempo para esta pregunta!
        </p>
      )}
    </div>
  );
}

export default TimedChoiceGame;
