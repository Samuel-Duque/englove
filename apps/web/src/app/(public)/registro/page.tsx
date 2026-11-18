import React, { Suspense } from "react";
import type { Metadata } from "next";
import { RegistroClient } from "./registro-client";
import { AccessLoading } from "../access-sheet";

export const metadata: Metadata = {
  title: "Registro de Estudiante",
  description: "Crea tu cuenta de estudiante en Upward English.",
};

export default function RegistroPage() {
  return (
    <Suspense
      fallback={
        <AccessLoading registration>
          Cargando formulario de registro…
        </AccessLoading>
      }
    >
      <RegistroClient />
    </Suspense>
  );
}
