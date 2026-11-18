import React, { Suspense } from "react";
import type { Metadata } from "next";
import { OfflineClient } from "./offline-client";
import { SystemSheet } from "../origami-system-sheet";

export const metadata: Metadata = {
  title: "Sin conexión",
  description: "No hay conexión a internet disponible.",
};

export default function OfflinePage() {
  return (
    <Suspense fallback={<SystemSheet description="Verificando conexión…" />}>
      <OfflineClient />
    </Suspense>
  );
}
