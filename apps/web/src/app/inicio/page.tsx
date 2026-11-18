import React, { Suspense } from "react";
import type { Metadata } from "next";
import { InicioClient } from "./inicio-client";

export const metadata: Metadata = {
  title: "Inicio",
  description: "Panel de inicio de actividades y misiones en Upward English.",
};

export default function InicioPage() {
  return (
    <Suspense
      fallback={
        <main
          id="main-content"
          tabIndex={-1}
          className="origami-container origami-container--reading py-8"
        >
          <p role="status" className="origami-state">
            Cargando tu espacio…
          </p>
        </main>
      }
    >
      <InicioClient />
    </Suspense>
  );
}
