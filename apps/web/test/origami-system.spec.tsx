import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ErrorBoundary from "../src/app/error";
import GlobalError from "../src/app/global-error";

function findRetryAction(children: ReactNode): (() => void) | undefined {
  for (const child of React.Children.toArray(children)) {
    if (
      !React.isValidElement<{ children?: ReactNode; onClick?: () => void }>(
        child,
      )
    ) {
      continue;
    }
    if (child.type === "button") return child.props.onClick;
    const action = findRetryAction(child.props.children);
    if (action) return action;
  }
  return undefined;
}

describe("Origami: límites de error", () => {
  const error = Object.assign(new Error("mensaje interno de prueba"), {
    digest: "internal-digest",
  });

  it.each([
    ["segmento", ErrorBoundary],
    ["documento", GlobalError],
  ])(
    "ofrece la acción real de recuperación en el %s sin exponer el error",
    (_, Boundary) => {
      const reset = vi.fn();
      const fallback = Boundary({ error, reset });
      const markup = renderToStaticMarkup(fallback);

      expect(markup).toContain('<main id="main-content" tabindex="-1"');
      expect(markup).toContain("origami-card");
      expect(markup).toContain('role="alert"');
      expect(markup).toContain("Algo no salió bien. Intenta otra vez");
      expect(markup).toContain('<button type="button" class="origami-button">');
      expect(markup).toContain("Reintentar</button>");
      expect(markup).not.toContain(error.message);
      expect(markup).not.toContain(error.digest);
      expect(reset).not.toHaveBeenCalled();

      const retry = findRetryAction(fallback);
      expect(retry).toBeDefined();
      retry?.();
      expect(reset).toHaveBeenCalledOnce();
    },
  );

  it("usa un documento global en español y un recurso de apariencia del mismo origen", () => {
    const markup = renderToStaticMarkup(
      <GlobalError error={error} reset={vi.fn()} />,
    );
    expect(markup).toContain('<html lang="es">');
    expect(markup).toContain("<body");
    expect(markup.match(/<script\b[^>]*>/g)).toEqual([
      '<script src="/origami-appearance.js">',
    ]);
  });
});
