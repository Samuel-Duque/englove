import React from "react";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function CorrectionFeedback({
  correction,
}: {
  correction: Record<string, unknown>;
}) {
  const summary = correction.summary;
  if (
    isRecord(summary) &&
    typeof summary.foundPairs === "number" &&
    typeof summary.totalPairs === "number" &&
    typeof summary.failedSelections === "number"
  ) {
    return (
      <div>
        <p>
          Parejas encontradas: {summary.foundPairs} de {summary.totalPairs}
        </p>
        <p>Intentos fallidos: {summary.failedSelections}</p>
      </div>
    );
  }

  return Object.entries(correction).map(([itemId, value], index) => {
    if (!isRecord(value)) return null;
    if (typeof value.correct === "boolean") {
      return (
        <div key={itemId}>
          {value.correct ? "✅" : "❌"}{" "}
          <span className="font-semibold text-zinc-800">
            Respuesta {index + 1}: {value.correct ? "Correcto" : "Incorrecto"}
          </span>
        </div>
      );
    }
    return (
      <div key={itemId} className="space-y-1">
        {Object.entries(value).map(([blankId, result], blankIndex) => {
          if (!isRecord(result) || typeof result.correct !== "boolean")
            return null;
          return (
            <div key={blankId} className="flex items-center gap-2">
              <span>{result.correct ? "✅" : "❌"}</span>
              <span className="font-semibold text-zinc-800">
                Espacio {blankIndex + 1}:{" "}
                {result.correct ? "Correcto" : "Incorrecto"}
              </span>
            </div>
          );
        })}
      </div>
    );
  });
}
