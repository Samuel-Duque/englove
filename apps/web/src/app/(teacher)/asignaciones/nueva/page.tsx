import React, { Suspense } from "react";
import type { Metadata } from "next";
import { NuevaAsignacionClient } from "./nueva-asignacion-client";

export const metadata: Metadata = {
  title: "Nueva Asignación",
  description: "Programa una nueva actividad para un grupo de estudiantes.",
};

export default function NewAssignmentPage() {
  return (
    <Suspense
      fallback={
        <div className="origami-state" role="status">
          Cargando formulario de asignación…
        </div>
      }
    >
      <NuevaAsignacionClient />
    </Suspense>
  );
}
