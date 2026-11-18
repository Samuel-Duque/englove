"use client";

import React from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { SystemSheet } from "./origami-system-sheet";
import styles from "./origami-system.module.css";
import "./globals.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* El documento de emergencia no conserva el script del layout. */}
        <script src="/origami-appearance.js" />
      </head>
      <body className={styles.document}>
        <SystemSheet
          title="¡Ups!"
          description="Algo no salió bien. Intenta otra vez"
          icon={<TriangleAlert />}
          variant="error"
        >
          <button type="button" onClick={reset} className="origami-button">
            <RotateCcw aria-hidden="true" />
            Reintentar
          </button>
        </SystemSheet>
      </body>
    </html>
  );
}
