import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CorrectionFeedback } from "./CorrectionFeedback";

describe("ERR-01: retroalimentación de respuestas", () => {
  it("muestra una respuesta por elemento de juego y respeta su resultado", () => {
    const html = renderToStaticMarkup(
      <CorrectionFeedback
        correction={{
          a: { correct: true, expected: "x", submitted: "x" },
          b: { correct: false, expected: "y", submitted: null },
        }}
      />,
    );
    expect(html).toContain("Respuesta 1: Correcto");
    expect(html).toContain("Respuesta 2: Incorrecto");
    expect(html).not.toContain("Espacio");
  });

  it("conserva la retroalimentación por espacios de actividades y exámenes", () => {
    const html = renderToStaticMarkup(
      <CorrectionFeedback
        correction={{ item: { a: { correct: true }, b: { correct: false } } }}
      />,
    );
    expect(html).toContain("Espacio 1: Correcto");
    expect(html).toContain("Espacio 2: Incorrecto");
  });

  it("muestra el resumen de memoria sin convertir sus métricas en errores", () => {
    const html = renderToStaticMarkup(
      <CorrectionFeedback
        correction={{
          summary: { foundPairs: 2, totalPairs: 3, failedSelections: 1 },
          pairs: [],
        }}
      />,
    );
    expect(html).toContain("Parejas encontradas: 2 de 3");
    expect(html).toContain("Intentos fallidos: 1");
    expect(html).not.toContain("Incorrecto");
  });
});
