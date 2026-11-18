import React, { Suspense } from "react";
import type { Metadata } from "next";
import { RecuperarContrasenaClient } from "./recuperar-contrasena-client";
import { AccessLoading } from "../access-sheet";

export const metadata: Metadata = {
  title: "Recuperar Contraseña",
  description:
    "Solicita un enlace para restablecer la contraseña de tu cuenta en Upward English.",
};

export default function RecuperarContrasenaPage() {
  return (
    <Suspense fallback={<AccessLoading>Cargando…</AccessLoading>}>
      <RecuperarContrasenaClient />
    </Suspense>
  );
}
