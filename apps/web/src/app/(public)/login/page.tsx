import React, { Suspense } from "react";
import type { Metadata } from "next";
import { LoginClient } from "./login-client";
import { AccessLoading } from "../access-sheet";

export const metadata: Metadata = {
  title: "Iniciar Sesión",
  description:
    "Ingresa a la plataforma Upward English para continuar tus actividades de inglés.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<AccessLoading>Comprobando tu sesión…</AccessLoading>}>
      <LoginClient />
    </Suspense>
  );
}
