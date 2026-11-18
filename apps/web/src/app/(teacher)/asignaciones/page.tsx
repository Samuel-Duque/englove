import React, { Suspense } from "react";
import type { Metadata } from "next";
import { AsignacionesClient } from "./asignaciones-client";

export const metadata: Metadata = {
  title: "Asignaciones",
  description:
    "Gestión y programación de asignaciones de actividades para grupos de estudiantes.",
};

export default function AssignmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="origami-state" role="status">
          Cargando asignaciones…
        </div>
      }
    >
      <AsignacionesClient />
    </Suspense>
  );
}
