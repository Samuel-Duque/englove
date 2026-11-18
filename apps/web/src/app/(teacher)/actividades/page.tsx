import React, { Suspense } from "react";
import type { Metadata } from "next";
import { ActividadesClient } from "./actividades-client";

export const metadata: Metadata = {
  title: "Catálogo de Actividades",
  description:
    "Diseño y gestión de contenido pedagógico, ejercicios y microjuegos.",
};

export default function ActivitiesCatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="origami-state" role="status">
          Cargando catálogo de actividades…
        </div>
      }
    >
      <ActividadesClient />
    </Suspense>
  );
}
