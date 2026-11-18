"use client";

import React, { useId } from "react";
import {
  formatBlankPrompt,
  formatBlankPromptForSpeech,
} from "../../lib/blank-prompt";

type ResponseFields = {
  answers: Readonly<Record<string, unknown>>;
  onAnswerChange: (itemId: string, value: unknown) => void;
  disabled?: boolean;
  onSpeak?: (text: string) => void;
};

type SentenceItem = {
  id: string;
  prompt: string;
  weight?: number;
  blanks: ReadonlyArray<{
    id: string;
    options?: ReadonlyArray<{ id: string; text: string }>;
  }>;
};

function getStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") result[key] = entry;
  }
  return result;
}

function ListenButton({
  text,
  label,
  onSpeak,
}: {
  text: string;
  label: string;
  onSpeak?: (text: string) => void;
}) {
  if (!onSpeak) return null;
  return (
    <button
      type="button"
      onClick={() => onSpeak(text)}
      className="origami-button origami-button--secondary"
      aria-label={label}
    >
      <span aria-hidden="true">🔊</span>{" "}
      {label === "Escuchar modelo" ? label : "Escuchar"}
    </button>
  );
}

export function SentenceRenderer({
  items,
  exam,
  answers,
  onAnswerChange,
  disabled,
  onSpeak,
}: ResponseFields & { items: ReadonlyArray<SentenceItem>; exam?: boolean }) {
  const fieldPrefix = useId();

  return (
    <div className="space-y-6">
      <p className="origami-meta">
        {exam
          ? "Examen — Responde cada una de las oraciones:"
          : "Completa los espacios en blanco con la palabra correcta:"}
      </p>
      {items.map((item, itemIndex) => {
        const itemAnswers = getStringRecord(answers[item.id]);
        return (
          <div key={item.id} className="origami-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="origami-label">
                {exam
                  ? `Ítem #${itemIndex + 1} (Peso: ${item.weight})`
                  : `Pregunta ${itemIndex + 1}`}
              </p>
              <ListenButton
                text={formatBlankPromptForSpeech(item.prompt)}
                label={`Escuchar ${exam ? "ítem" : "pregunta"} ${itemIndex + 1}`}
                onSpeak={onSpeak}
              />
            </div>
            <p>{formatBlankPrompt(item.prompt, item.blanks)}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {item.blanks.map((blank, blankIndex) => {
                const fieldId = `${fieldPrefix}-${itemIndex}-${blankIndex}`;
                const space = `Espacio ${blankIndex + 1}`;
                const label = exam
                  ? `${space} del ítem ${itemIndex + 1}`
                  : space;
                const rawValue = exam
                  ? itemAnswers[blank.id]
                  : itemAnswers[blank.id] || answers[blank.id];
                const fieldProps = {
                  id: fieldId,
                  "aria-label": label,
                  disabled,
                  value: typeof rawValue === "string" ? rawValue : "",
                  className: "origami-field",
                  onChange: (
                    event: React.ChangeEvent<
                      HTMLInputElement | HTMLSelectElement
                    >,
                  ) =>
                    onAnswerChange(item.id, {
                      ...itemAnswers,
                      [blank.id]: event.target.value,
                    }),
                };

                return (
                  <div key={blank.id || fieldId} className="space-y-1">
                    <label htmlFor={fieldId} className="origami-meta block">
                      {space}:
                    </label>
                    {blank.options?.length ? (
                      <select {...fieldProps}>
                        <option value="">-- Elige una opción --</option>
                        {blank.options.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.text}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        {...fieldProps}
                        type="text"
                        placeholder={
                          exam ? "Tu respuesta…" : "Escribe tu respuesta…"
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OpenQuestionRenderer({
  items,
  instructions,
  answers,
  onAnswerChange,
  disabled,
  onSpeak,
}: ResponseFields & {
  items: ReadonlyArray<{ id: string; prompt: string; maxLength: number }>;
  instructions?: string;
}) {
  return (
    <div className="space-y-6">
      {instructions && (
        <div className="origami-card space-y-1">
          <p className="origami-label">Instrucciones generales</p>
          <p>{instructions}</p>
        </div>
      )}
      {items.map((item, index) => {
        const isSingle = items.length === 1;
        const savedAnswer = answers[item.id];
        const legacyAnswer = answers.text;
        const answer =
          typeof savedAnswer === "string"
            ? savedAnswer
            : isSingle && typeof legacyAnswer === "string"
              ? legacyAnswer
              : "";
        const prompt =
          item.prompt || "Escribe tu respuesta a continuación en inglés:";
        const maxLength = item.maxLength || 2000;
        return (
          <div key={item.id} className="origami-card space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="origami-label">
                  {isSingle ? "Pregunta abierta" : `Pregunta ${index + 1}`}
                </p>
                <p>{prompt}</p>
              </div>
              <ListenButton
                onSpeak={onSpeak}
                text={prompt}
                label={`Escuchar consigna ${index + 1}`}
              />
            </div>
            <textarea
              aria-label={`Tu respuesta en inglés para pregunta ${index + 1}`}
              disabled={disabled}
              rows={isSingle ? 6 : 4}
              maxLength={maxLength}
              value={answer}
              onChange={(event) => {
                const value = event.target.value;
                onAnswerChange(item.id, value);
                if (isSingle) onAnswerChange("text", value);
              }}
              placeholder="Escribe aquí tu respuesta detallada…"
              className="origami-field min-h-36"
            />
            <p className="origami-meta text-right">
              {answer.length} / {maxLength} caracteres
            </p>
          </div>
        );
      })}
    </div>
  );
}

export type RecorderControls =
  | { mode: "preview"; onStart: () => void; notice?: string }
  | {
      mode: "attempt";
      isRecording: boolean;
      recordingSeconds: number;
      savedDuration: string | null;
      isUploading: boolean;
      progress: string | null;
      error: string | null;
      onStart: () => void;
      onStop: () => void;
      onRetry: () => void;
    };

export function SpeakingRenderer({
  prompt,
  onSpeak,
  recorder,
}: {
  prompt?: string;
  onSpeak?: (text: string) => void;
  recorder?: RecorderControls;
}) {
  const attempt = recorder?.mode === "attempt" ? recorder : null;
  const isRecording = attempt?.isRecording;
  const seconds = attempt?.recordingSeconds ?? 0;
  const timer = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  return (
    <div className="space-y-6">
      <div className="origami-card space-y-2">
        <p className="origami-label">Instrucción de pronunciación / Speaking</p>
        <p>{prompt || "Graba tu voz leyendo la oración en voz alta."}</p>
        <ListenButton
          onSpeak={onSpeak}
          text={prompt ?? ""}
          label="Escuchar modelo"
        />
      </div>

      {recorder && (
        <div className="origami-card space-y-4 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span
              aria-hidden="true"
              className={`inline-block h-4 w-4 rounded-full ${isRecording ? "bg-[var(--origami-error-text)]" : "bg-[var(--origami-border-subtle)]"}`}
            />
            <span className="origami-label origami-tabular">{timer}</span>
            <span className="origami-meta">
              {isRecording ? "Grabando · " : ""}máx. 2:00 min
            </span>
          </div>

          {isRecording ? (
            <button
              type="button"
              onClick={attempt?.onStop}
              className="origami-button origami-button--secondary"
            >
              <span aria-hidden="true">⏹️</span> Detener grabación
            </button>
          ) : (
            <button
              type="button"
              onClick={recorder.onStart}
              disabled={attempt?.isUploading}
              className="origami-button"
            >
              <span aria-hidden="true">🎙️</span>{" "}
              {attempt?.savedDuration ? "Volver a grabar" : "Empezar a grabar"}
            </button>
          )}

          {recorder.mode === "preview" && recorder.notice && (
            <p role="status" className="origami-state">
              {recorder.notice}
            </p>
          )}
          {!isRecording && attempt?.savedDuration && (
            <p className="origami-state origami-state--success">
              <span aria-hidden="true">✅</span> Grabación lista para enviar (
              {attempt.savedDuration})
            </p>
          )}
          {attempt?.error && (
            <div className="origami-state origami-state--error mx-auto max-w-sm space-y-2">
              <p role="alert" className="font-bold">
                {attempt.error}
              </p>
              <button
                type="button"
                onClick={attempt.onRetry}
                disabled={attempt.isUploading}
                className="origami-button origami-button--secondary"
              >
                {attempt.isUploading ? "Reintentando…" : "Reintentar envío"}
              </button>
            </div>
          )}
          {attempt?.progress && (
            <p role="status" className="origami-meta">
              {attempt.progress}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
