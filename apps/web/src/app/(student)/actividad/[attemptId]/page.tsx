import React, { Suspense } from "react";
import type { Metadata } from "next";
import { ActividadRunner } from "./actividad-runner";

export const metadata: Metadata = {
  title: "Actividad en Curso",
};

interface PageProps {
  params: Promise<{ attemptId: string }>;
}

export default async function ActividadPage({ params }: PageProps) {
  const { attemptId } = await params;
  return (
    <Suspense
      fallback={
        <p role="status" className="origami-state">
          Cargando actividad…
        </p>
      }
    >
      <ActividadRunner attemptId={attemptId} />
    </Suspense>
  );
}
