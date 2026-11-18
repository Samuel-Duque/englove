"use client";

import React from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { SystemSheet } from "./origami-system-sheet";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SystemSheet
      title="¡Ups!"
      description="Algo no salió bien. Intenta otra vez"
      icon={<TriangleAlert />}
      variant="error"
      segment
    >
      <button type="button" onClick={reset} className="origami-button">
        <RotateCcw aria-hidden="true" />
        Reintentar
      </button>
    </SystemSheet>
  );
}
