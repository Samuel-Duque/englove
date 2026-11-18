"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AccessResult } from "../access-result";
import { AccessSheet } from "../access-sheet";
import styles from "../public-origami.module.css";
import { useMutation } from "@tanstack/react-query";
import { getAuthErrorMessage } from "../../../lib/auth-errors";

export function RecuperarContrasenaClient() {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const forgotPasswordMutation = useMutation({
    mutationFn: async (emailVal: string) => {
      const res = await fetch(`${apiUrl}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify({ email: emailVal }),
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
        throw new Error(getAuthErrorMessage(code, msg));
      }

      const message =
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof data.message === "string"
          ? data.message
          : "Si el correo tiene una cuenta, recibirás un enlace para restablecer tu contraseña.";

      return { message };
    },
    onSuccess: (data) => {
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
    forgotPasswordMutation.mutate(email);
  };

  if (successMessage) {
    return (
      <AccessResult
        title="Revisa tu correo"
        message={successMessage}
        action="Volver a iniciar sesión"
        email
      />
    );
  }

  return (
    <AccessSheet>
      <header className={styles.intro}>
        <h1 className="origami-page-title">Recuperar contraseña</h1>
        <p className="origami-meta">
          Ingresa el correo asociado a tu cuenta y te enviaremos las
          instrucciones para restablecer tu contraseña.
        </p>
      </header>

      {errorMessage && (
        <p role="alert" className="origami-state origami-state--error">
          {errorMessage}
        </p>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="email" className="origami-label">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="origami-field"
          />
        </div>

        <button
          type="submit"
          disabled={forgotPasswordMutation.isPending}
          className="origami-button"
        >
          {forgotPasswordMutation.isPending ? "Enviando…" : "Enviar enlace"}
        </button>
      </form>

      <Link href="/login" className={styles.textLink}>
        Volver a iniciar sesión
      </Link>
    </AccessSheet>
  );
}
