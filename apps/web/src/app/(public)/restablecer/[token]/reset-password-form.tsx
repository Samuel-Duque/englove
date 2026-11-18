"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AccessResult } from "../../access-result";
import { AccessSheet } from "../../access-sheet";
import styles from "../../public-origami.module.css";
import { useParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { getAuthErrorMessage } from "../../../../lib/auth-errors";

export function ResetPasswordForm() {
  const params = useParams();
  const token = typeof params?.token === "string" ? params.token : "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isTokenInvalid, setIsTokenInvalid] = useState(false);
  const [invalidField, setInvalidField] = useState<
    "password" | "confirmation" | null
  >(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const resetPasswordMutation = useMutation({
    mutationFn: async ({
      tokenVal,
      newPasswordVal,
    }: {
      tokenVal: string;
      newPasswordVal: string;
    }) => {
      const res = await fetch(`${apiUrl}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          token: tokenVal,
          newPassword: newPasswordVal,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const code =
          data &&
          typeof data === "object" &&
          "code" in data &&
          typeof data.code === "string"
            ? data.code
            : undefined;
        const msg =
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof data.message === "string"
            ? data.message
            : undefined;
        if (code === "PASSWORD_RESET_INVALID") {
          setIsTokenInvalid(true);
        }
        throw new Error(getAuthErrorMessage(code, msg));
      }

      const message =
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof data.message === "string"
          ? data.message
          : "Contraseña actualizada. Inicia sesión.";

      return { message };
    },
    onSuccess: (data) => {
      // RF-12: Uniform success message
      setSuccessMessage(data.message);
    },
    onError: (err: Error) => {
      setErrorMessage(
        err.message ||
          "No fue posible conectar con el servidor. Verifica tu conexión.",
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInvalidField(null);

    // Local validation check
    if (newPassword !== confirmPassword) {
      setInvalidField("confirmation");
      setErrorMessage("Las contraseñas no coinciden");
      return;
    }

    const unicodeLen = [...newPassword].length;
    if (unicodeLen < 8 || unicodeLen > 16 || /\s/u.test(newPassword)) {
      setInvalidField("password");
      setErrorMessage("Usa entre 8 y 16 caracteres, sin espacios");
      return;
    }

    resetPasswordMutation.mutate({
      tokenVal: token,
      newPasswordVal: newPassword,
    });
  };

  if (successMessage) {
    return (
      <AccessResult
        title="Contraseña actualizada"
        message={successMessage}
        action="Iniciar sesión"
      />
    );
  }

  return (
    <AccessSheet>
      <header className={styles.intro}>
        <h1 className="origami-page-title">Crear nueva contraseña</h1>
        <p className="origami-meta">
          Ingresa y confirma tu nueva contraseña de acceso.
        </p>
      </header>

      {errorMessage && (
        <p
          id="reset-error"
          role="alert"
          className="origami-state origami-state--error"
        >
          {errorMessage}
        </p>
      )}

      {isTokenInvalid ? (
        <Link href="/recuperar-contrasena" className="origami-button">
          Solicitar un nuevo enlace
        </Link>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="newPassword" className="origami-label">
              Nueva contraseña
            </label>
            <input
              id="newPassword"
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (invalidField) {
                  setInvalidField(null);
                  setErrorMessage(null);
                }
              }}
              className="origami-field"
              aria-invalid={invalidField === "password" || undefined}
              aria-describedby={
                invalidField === "password"
                  ? "reset-password-hint reset-error"
                  : "reset-password-hint"
              }
            />
            <p id="reset-password-hint" className="origami-meta">
              Usa entre 8 y 16 caracteres, sin espacios.
            </p>
          </div>

          <div className={styles.field}>
            <label htmlFor="confirmPassword" className="origami-label">
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (invalidField === "confirmation") {
                  setInvalidField(null);
                  setErrorMessage(null);
                }
              }}
              className="origami-field"
              aria-invalid={invalidField === "confirmation" || undefined}
              aria-describedby={
                invalidField === "confirmation" ? "reset-error" : undefined
              }
            />
          </div>

          <button
            type="submit"
            disabled={resetPasswordMutation.isPending}
            className="origami-button"
          >
            {resetPasswordMutation.isPending
              ? "Guardando…"
              : "Guardar contraseña"}
          </button>
        </form>
      )}

      <Link href="/login" className={styles.textLink}>
        Volver a iniciar sesión
      </Link>
    </AccessSheet>
  );
}
