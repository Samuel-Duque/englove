import React, { Suspense } from "react";
import type { Metadata } from "next";
import { ActivityEditorComponent } from "../activity-editor";

export const metadata: Metadata = {
  title: "Crear Nueva Actividad",
  description: "Diseñador de nuevas actividades pedagógicas para estudiantes.",
};

export default function NuevaActividadPage() {
  return (
    <Suspense
      fallback={
        <div className="origami-state" role="status">
          Cargando editor de actividad…
        </div>
      }
    >
      <ActivityEditorComponent />
    </Suspense>
  );
}
