import React, { Suspense } from "react";
import type { Metadata } from "next";
import { ProgresoClient } from "./progreso-client";

export const metadata: Metadata = {
  title: "Mi Progreso",
};

export default function ProgresoPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="origami-state">
          Cargando tus logros…
        </p>
      }
    >
      <ProgresoClient />
    </Suspense>
  );
}
