import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";
import { AccessLoading } from "../../access-sheet";

export const metadata: Metadata = {
  referrer: "no-referrer",
  title: "Restablecer Contraseña",
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AccessLoading>Cargando…</AccessLoading>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
