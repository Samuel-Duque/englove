'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityRuntimeProps,
  GamePublicConfig,
  GameAnswers,
  TimedChoiceSettings,
  TimedChoiceSolution,
} from '@englove/shared';
import { soundManager } from '../../../lib/sound';

export function TimedChoiceGame({
  config,
  theme = 'kids',
  soundEnabled = true,
  previewMode = false,
  onEvent,
  onComplete,
}: ActivityRuntimeProps<GamePublicConfig, GameAnswers>) {
  const settings = config.settings as TimedChoiceSettings;
  const solution = config.answerKey?.solution as TimedChoiceSolution | undefined;

  const questions = settings?.questions || [];
  const timeLimitSeconds = settings?.timeLimitSeconds || 20;

  // Decision 106: Always start at question index 0 with choices = {} and full timer
  const [currentIndex, setCurrentIndex] = useState(0);
  const [choices, setChoices] = useState<Record<string, string | null>>({});
  const [secondsLeft, setSecondsLeft] = useState(timeLimitSeconds);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [isWaitingFeedback, setIsWaitingFeedback] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentQuestion = questions[currentIndex];
  const expectedOptionId = currentQuestion && solution?.choices ? solution.choices[currentQuestion.id] : null;

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  // Decision 106: Always reset choices in attempt payload on initial mount
  useEffect(() => {
    onEvent?.({ itemId: 'choices', answer: {} });
  }, []);

  // Countdown timer for each question
  useEffect(() => {
    if (isWaitingFeedback || !currentQuestion) return;

    setSecondsLeft(timeLimitSeconds);
    setSelectedOptionId(null);
    setIsTimedOut(false);

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
    soundManager.play('miss', soundEnabled);

    const nextChoices = { ...choices, [currentQuestion.id]: null };
    setChoices(nextChoices);
    onEvent?.({ itemId: 'choices', answer: nextChoices });

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
    soundManager.play(isCorrect ? 'hit' : 'miss', soundEnabled);

    const nextChoices = { ...choices, [currentQuestion.id]: optionId };
    setChoices(nextChoices);
    onEvent?.({ itemId: 'choices', answer: nextChoices });

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
      soundManager.play('complete', soundEnabled);
      onComplete?.({ choices: finalChoices });
    }
  };

  const isKids = theme === 'kids';

  if (!currentQuestion) {
    return (
      <div className="p-8 text-center text-zinc-500 font-semibold">
        No hay preguntas disponibles en este microjuego.
      </div>
    );
  }

  const progressPercent = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div
      className={`w-full max-w-2xl mx-auto p-4 sm:p-6 rounded-3xl ${
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

      {/* Progress & Countdown Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-amber-800">
            Pregunta {currentIndex + 1} de {questions.length}
          </span>
          <div className="w-32 sm:w-44 h-2 bg-amber-200/60 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Timer Badge */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border-2 font-mono font-black text-sm transition-colors ${
              secondsLeft <= 5
                ? 'border-rose-400 bg-rose-100 text-rose-700 animate-pulse'
                : isKids
                  ? 'border-amber-300 bg-white text-amber-950'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-100'
            }`}
          >
            <span>⏱️</span>
            <span>{secondsLeft}s</span>
          </div>
        </div>
      </div>

      {/* Question Prompt */}
      <div className={`mb-6 p-6 rounded-3xl border shadow-xs text-center ${
        isKids ? 'bg-white border-amber-200/80' : 'bg-zinc-800/90 border-zinc-700'
      }`}>
        <h3 className={`text-lg sm:text-xl font-black leading-snug ${
          isKids ? 'text-zinc-900' : 'text-zinc-100'
        }`}>
          {currentQuestion.prompt}
        </h3>
      </div>

      {/* Options List */}
      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((opt) => {
          const isSelected = selectedOptionId === opt.id;
          const isExpected = expectedOptionId === opt.id;

          let btnStyle = isKids
            ? 'border-amber-200 bg-white text-zinc-900 hover:border-amber-400 hover:bg-amber-50'
            : 'border-zinc-700 bg-zinc-800 text-zinc-100 hover:border-zinc-500';

          if (isWaitingFeedback) {
            if (isSelected) {
              btnStyle = isExpected
                ? 'border-emerald-500 bg-emerald-100 text-emerald-950 ring-4 ring-emerald-300 scale-102 font-black'
                : 'border-rose-500 bg-rose-100 text-rose-950 ring-4 ring-rose-300 scale-102 font-black';
            } else if (isExpected && (isSelected || isTimedOut)) {
              btnStyle = 'border-emerald-400 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-300 font-black';
            }
          }

          return (
            <button
              key={opt.id}
              type="button"
              disabled={isWaitingFeedback}
              onClick={() => handleSelectOption(opt.id)}
              className={`w-full min-h-14 p-4 rounded-2xl border-2 font-bold text-base flex items-center justify-between text-left transition-all touch-manipulation cursor-pointer select-none active:scale-98 shadow-xs ${btnStyle}`}
            >
              <span>{opt.text}</span>
              <span className="text-xs font-black" aria-hidden="true">
                {isWaitingFeedback && isSelected
                  ? isExpected
                    ? '✅ Correcto'
                    : '❌ Incorrecto'
                  : isWaitingFeedback && isExpected && isTimedOut
                    ? '👈 Correcta'
                    : '👉'}
              </span>
            </button>
          );
        })}
      </div>

      {isTimedOut && (
        <p className="text-center text-xs font-bold text-rose-600 animate-bounce">
          ¡Se acabó el tiempo para esta pregunta!
        </p>
      )}
    </div>
  );
}

export default TimedChoiceGame;
