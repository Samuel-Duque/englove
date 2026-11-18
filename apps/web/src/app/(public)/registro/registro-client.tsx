"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AccessResult } from "../access-result";
import { AccessSheet } from "../access-sheet";
import styles from "../public-origami.module.css";
import { useMutation } from "@tanstack/react-query";
import { getAuthErrorMessage } from "../../../lib/auth-errors";

export function RegistroClient() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianContact, setGuardianContact] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isPasswordInvalid, setIsPasswordInvalid] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const registerMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`${apiUrl}/api/v1/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const code =
          data &&
          typeof data === "object" &&
          "code" in data &&
          typeof data.code === "string"
            ? data.code
            : undefined;
        throw new Error(getAuthErrorMessage(code));
      }

      const data = await res.json().catch(() => null);
      const message =
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof data.message === "string"
          ? data.message
          : "¡Solicitud enviada con éxito! Tu cuenta está en revisión. Tu docente la aprobará pronto para que puedas ingresar.";
      return { message };
    },
    onSuccess: (data) => {
      setSuccessMessage(data.message);
    },
    onError: (err: Error) => {
      setErrorMessage(
        err.message ||
          "Ocurrió un error inesperado. Intenta de nuevo más tarde",
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsPasswordInvalid(false);

    // Client-side password policy check (RF-8)
    if (password.length < 8 || password.length > 16 || /\s/.test(password)) {
      setIsPasswordInvalid(true);
      setErrorMessage("Usa entre 8 y 16 caracteres, sin espacios");
      return;
    }

    if (!acceptTerms) {
      setErrorMessage(
        "Debes aceptar los términos y condiciones para continuar",
      );
      return;
    }

    const payload: Record<string, unknown> = {
      name,
      email,
      password,
      birthDate,
      acceptTerms: true,
    };

    if (guardianName.trim()) {
      payload.guardianName = guardianName.trim();
    }
    if (guardianContact.trim()) {
      payload.guardianContact = guardianContact.trim();
    }

    registerMutation.mutate(payload);
  };

  if (successMessage) {
    return (
      <AccessResult
        title="Solicitud de registro enviada"
        message={successMessage}
        action="Ir al inicio de sesión"
      />
    );
  }

  return (
    <AccessSheet registration>
      <header className={styles.intro}>
        <h1 className="origami-page-title">Crea tu cuenta</h1>
        <p className="origami-meta">
          Registro de estudiante para aprender inglés en Upward English.
        </p>
      </header>

      {errorMessage && (
        <p
          id="registration-error"
          role="alert"
          className="origami-state origami-state--error"
        >
          {errorMessage}
        </p>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="name-input" className="origami-label">
            Nombre completo del alumno
          </label>
          <input
            id="name-input"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="origami-field"
            placeholder="Ej. Lucas Gómez"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="email-input" className="origami-label">
            Correo electrónico
          </label>
          <input
            id="email-input"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="origami-field"
            placeholder="lucas@ejemplo.com"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="birthdate-input" className="origami-label">
            Fecha de nacimiento
          </label>
          <input
            id="birthdate-input"
            name="birthDate"
            type="date"
            required
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="origami-field"
            aria-describedby="registration-birthdate-hint"
          />
          <p id="registration-birthdate-hint" className="origami-meta">
            La edad determina el segmento pedagógico (Kids: 7-10 años, Teens:
            11-14 años).
          </p>
        </div>

        <div className={styles.field}>
          <label htmlFor="password-input" className="origami-label">
            Contraseña
          </label>
          <input
            id="password-input"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (isPasswordInvalid) {
                setIsPasswordInvalid(false);
                setErrorMessage(null);
              }
            }}
            className="origami-field"
            aria-invalid={isPasswordInvalid || undefined}
            aria-describedby={
              isPasswordInvalid
                ? "registration-password-hint registration-error"
                : "registration-password-hint"
            }
          />
          <p id="registration-password-hint" className="origami-meta">
            Entre 8 y 16 caracteres, sin espacios
          </p>
        </div>

        <fieldset className={styles.guardianGroup}>
          <legend className="origami-label">
            Datos del Acudiente / Tutor (Opcional)
          </legend>
          <div className={styles.field}>
            <label htmlFor="guardian-name-input" className="origami-label">
              Nombre del acudiente
            </label>
            <input
              id="guardian-name-input"
              name="guardianName"
              type="text"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              className="origami-field"
              placeholder="Ej. María Gómez"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="guardian-contact-input" className="origami-label">
              Teléfono o correo del acudiente
            </label>
            <input
              id="guardian-contact-input"
              name="guardianContact"
              type="text"
              value={guardianContact}
              onChange={(e) => setGuardianContact(e.target.value)}
              className="origami-field"
              placeholder="Ej. 300 123 4567 o maria@ejemplo.com"
            />
          </div>
        </fieldset>

        <div className={styles.termsControl}>
          <label
            htmlFor="accept-terms-checkbox"
            className={styles.checkboxTarget}
          >
            <input
              id="accept-terms-checkbox"
              name="acceptTerms"
              type="checkbox"
              required
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              aria-labelledby="registration-terms-label"
            />
          </label>
          <p id="registration-terms-label" className={styles.termsLabel}>
            <label htmlFor="accept-terms-checkbox">Acepto los</label>{" "}
            <Link
              href="/terminos"
              target="_blank"
              className={styles.inlineLink}
            >
              términos y condiciones
            </Link>{" "}
            <label htmlFor="accept-terms-checkbox">
              de la plataforma y el tratamiento de datos para fines educativos.
            </label>
          </p>
        </div>

        <button
          type="submit"
          disabled={registerMutation.isPending}
          className="origami-button"
        >
          {registerMutation.isPending ? "Enviando…" : "Enviar solicitud"}
        </button>
      </form>

      <div className={styles.related}>
        <span className="origami-meta">¿Ya tienes una cuenta?</span>
        <Link href="/login" className={styles.textLink}>
          Inicia sesión
        </Link>
      </div>
    </AccessSheet>
  );
}
