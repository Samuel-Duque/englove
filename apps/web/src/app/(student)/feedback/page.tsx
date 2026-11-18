import React, { Suspense } from "react";
import type { Metadata } from "next";
import { FeedbackClient } from "./feedback-client";

export const metadata: Metadata = {
  title: "Mi Retroalimentación",
  description:
    "Calificaciones, comentarios de tu profesora y stickers obtenidos en tus actividades.",
};

export default function StudentFeedbackPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="origami-state">
          Cargando tus comentarios y notas…
        </p>
      }
    >
      <FeedbackClient />
    </Suspense>
  );
}
