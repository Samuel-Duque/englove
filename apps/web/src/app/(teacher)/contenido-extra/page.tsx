import React, { Suspense } from "react";
import type { Metadata } from "next";
import {
  ContenidoExtraClient,
  ContenidoExtraSkeleton,
} from "./contenido-extra-client";

export const metadata: Metadata = {
  title: "Contenido Extra",
  description: "Gestión docente de enlaces y recursos pedagógicos externos.",
};

export default function ContenidoExtraPage() {
  return (
    <Suspense fallback={<ContenidoExtraSkeleton />}>
      <ContenidoExtraClient />
    </Suspense>
  );
}
