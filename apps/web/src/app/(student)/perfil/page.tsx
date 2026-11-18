import React, { Suspense } from "react";
import type { Metadata } from "next";
import { PerfilClient } from "./perfil-client";

export const metadata: Metadata = {
  title: "Mi Perfil",
};

export default function PerfilPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="origami-state">
          Cargando tu perfil…
        </p>
      }
    >
      <PerfilClient />
    </Suspense>
  );
}
