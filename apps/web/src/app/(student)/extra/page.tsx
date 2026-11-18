import React, { Suspense } from "react";
import type { Metadata } from "next";
import { ExtraClient } from "./extra-client";

export const metadata: Metadata = {
  title: "Contenido extra",
};

export default function ExtraPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="origami-state">
          Cargando contenido extra…
        </p>
      }
    >
      <ExtraClient />
    </Suspense>
  );
}
