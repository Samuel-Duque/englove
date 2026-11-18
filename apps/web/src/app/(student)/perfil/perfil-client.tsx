"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  StudentProfileView,
  StudentProfileViewSchema,
} from "@upward-english/shared";
import { apiFetch, ApiError } from "../../../lib/api";
import { clearSharedProfile } from "../../../lib/auth-session";
import { AppearanceSelector } from "../../../components/appearance-selector";
import { syncUserSegment } from "../../../lib/user-segment";

export function PerfilClient() {
  const queryClient = useQueryClient();

  const {
    data: profile,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["student", "profile"],
    queryFn: () =>
      apiFetch<StudentProfileView>("/api/v1/me", {
        schema: StudentProfileViewSchema,
      }),
  });

  const error =
    queryError instanceof ApiError
      ? queryError.message
      : queryError instanceof Error
        ? queryError.message
        : null;

  const [themeError, setThemeError] = useState<string | null>(null);

  // Email change state
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [isAwaitingOtp, setIsAwaitingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const themeMutation = useMutation({
    mutationFn: async (newSegment: "kids" | "teens") => {
      await apiFetch<void>("/api/v1/me/interface", {
        method: "PATCH",
        body: JSON.stringify({ ageSegment: newSegment }),
      });
      return newSegment;
    },
    onSuccess: (newSegment) => {
      clearSharedProfile();
      syncUserSegment(newSegment);
      void queryClient.invalidateQueries({ queryKey: ["student", "profile"] });
      window.location.reload();
    },
    onError: (err: unknown) => {
      setThemeError(
        err instanceof ApiError
          ? err.message
          : "No se pudo actualizar la interfaz",
      );
    },
  });

  const handleThemeChange = (newSegment: "kids" | "teens") => {
    if (!profile?.student?.canSwitchInterface) return;
    setThemeError(null);
    themeMutation.mutate(newSegment);
  };

  const isUpdatingTheme = themeMutation.isPending;

  const requestEmailMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>("/api/v1/me/email-change", {
        method: "POST",
        body: JSON.stringify({
          newEmail,
          currentPassword,
        }),
      }),
    onSuccess: () => {
      setEmailSuccess(
        "Código OTP enviado a tu nuevo correo. Escríbelo a continuación para confirmar.",
      );
      setIsAwaitingOtp(true);
      setCurrentPassword("");
    },
    onError: (err: unknown) => {
      setEmailError(
        err instanceof Error ? err.message : "No se pudo enviar la solicitud",
      );
    },
  });

  const handleRequestEmailChange = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);
    requestEmailMutation.mutate();
  };

  const confirmEmailMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>("/api/v1/me/email-change/confirm", {
        method: "POST",
        body: JSON.stringify({
          newEmail,
          otp: otpCode.trim(),
        }),
      }),
    onSuccess: async () => {
      clearSharedProfile();
      setEmailSuccess(
        "¡Correo actualizado exitosamente! El cambio ya está activo.",
      );
      setIsAwaitingOtp(false);
      setIsChangingEmail(false);
      setNewEmail("");
      setOtpCode("");
      await queryClient.invalidateQueries({ queryKey: ["student", "profile"] });
    },
    onError: (err: unknown) => {
      setEmailError(
        err instanceof Error
          ? err.message
          : "No se pudo confirmar el cambio de correo",
      );
    },
  });

  const handleConfirmEmailChange = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);
    confirmEmailMutation.mutate();
  };

  const isSubmittingEmail =
    requestEmailMutation.isPending || confirmEmailMutation.isPending;

  if (isLoading)
    return (
      <p role="status" className="origami-state">
        Cargando tu perfil…
      </p>
    );

  if (error || !profile) {
    return (
      <section
        role="alert"
        className="origami-state origami-state--error space-y-3"
      >
        <h1 className="origami-page-title">Error al cargar perfil</h1>
        <p>{error ?? "No pudimos obtener los datos de tu cuenta."}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="origami-button origami-button--secondary"
        >
          Reintentar
        </button>
      </section>
    );
  }

  const { user, student } = profile;
  const currentSegment = student?.ageSegment ?? "kids";
  const details = [
    ["Nombre completo", user.name],
    ["Correo electrónico", user.email],
    [
      "Nivel asignado",
      student?.level ? `Nivel ${student.level}` : "Sin asignar",
    ],
    [
      "Fecha de nacimiento civil",
      student?.birthDate
        ? new Date(student.birthDate).toLocaleDateString("es-CO", {
            timeZone: "America/Bogota",
          })
        : "—",
    ],
  ];
  const cancelEmailChange = () => {
    setIsAwaitingOtp(false);
    setIsChangingEmail(false);
    setNewEmail("");
    setCurrentPassword("");
    setOtpCode("");
    setEmailError(null);
    setEmailSuccess(null);
  };

  return (
    <div className="mx-auto max-w-[45rem] space-y-6 [overflow-wrap:anywhere]">
      <header className="space-y-2">
        <h1 className="origami-page-title">Tu Perfil de Alumno</h1>
        <p className="origami-reading">
          Consulta tu cuenta y ajusta cómo se ve tu portal.
        </p>
      </header>

      <section
        className="origami-card space-y-4"
        aria-labelledby="profile-account"
      >
        <h2 id="profile-account" className="origami-section-title">
          Datos de la cuenta
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label} className="space-y-1">
              <dt className="origami-meta">{label}</dt>
              <dd className="origami-label">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        className="origami-card space-y-3"
        aria-labelledby="profile-appearance"
      >
        <h2 id="profile-appearance" className="origami-section-title">
          Apariencia
        </h2>
        <p className="origami-meta">
          Elige claro, oscuro o el ajuste del dispositivo para esta pestaña.
          Esto no cambia tu interfaz Kids o Teens.
        </p>
        <AppearanceSelector authenticated />
      </section>

      <section
        className="origami-card space-y-3"
        aria-labelledby="profile-interface"
      >
        <h2 id="profile-interface" className="origami-section-title">
          Interfaz Kids o Teens
        </h2>
        <p className="origami-label">
          Interfaz actual: {currentSegment === "kids" ? "Kids" : "Teens"}
        </p>
        {themeError && (
          <p role="alert" className="origami-state origami-state--error">
            {themeError}
          </p>
        )}
        {student?.canSwitchInterface ? (
          <div
            role="group"
            aria-label="Elegir interfaz"
            className="grid gap-3 sm:grid-cols-2"
          >
            {(
              [
                [
                  "kids",
                  "Kids (7 a 10 años)",
                  "Botones amplios y apoyos de lectura.",
                ],
                [
                  "teens",
                  "Teens (11 a 14 años)",
                  "Una vista más compacta de las actividades.",
                ],
              ] as const
            ).map(([segment, label, description]) => (
              <div key={segment} className="space-y-2">
                <button
                  type="button"
                  disabled={isUpdatingTheme}
                  aria-pressed={currentSegment === segment}
                  onClick={() => {
                    if (currentSegment !== segment) handleThemeChange(segment);
                  }}
                  className={`origami-button origami-button--secondary w-full ${currentSegment === segment ? "origami-selected" : ""}`}
                >
                  {label}
                </button>
                <p className="origami-meta">{description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="origami-state">
            Por ahora no puedes elegir otra interfaz.
          </p>
        )}
      </section>

      <section
        className="origami-card space-y-4"
        aria-labelledby="profile-security"
      >
        <h2 id="profile-security" className="origami-section-title">
          Seguridad de la cuenta
        </h2>
        <p className="origami-meta">
          Puedes solicitar un cambio del correo registrado.
        </p>
        {emailSuccess && (
          <p role="status" className="origami-state origami-state--success">
            {emailSuccess}
          </p>
        )}
        {emailError && (
          <p role="alert" className="origami-state origami-state--error">
            {emailError}
          </p>
        )}
        {!isChangingEmail ? (
          <button
            type="button"
            onClick={() => {
              setIsChangingEmail(true);
              setEmailSuccess(null);
              setEmailError(null);
            }}
            className="origami-button origami-button--secondary"
          >
            Cambiar correo electrónico
          </button>
        ) : (
          <form
            onSubmit={
              isAwaitingOtp
                ? handleConfirmEmailChange
                : handleRequestEmailChange
            }
            className="max-w-md space-y-4"
          >
            {isAwaitingOtp ? (
              <div className="space-y-2">
                <label htmlFor="otp-code" className="origami-label">
                  Código de verificación OTP
                </label>
                <p id="otp-help" className="origami-meta">
                  Enviado a {newEmail}.
                </p>
                <input
                  id="otp-code"
                  aria-describedby="otp-help"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                  placeholder="123456"
                  className="origami-field"
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label htmlFor="new-email" className="origami-label">
                    Nuevo correo electrónico
                  </label>
                  <input
                    id="new-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    className="origami-field"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="current-password" className="origami-label">
                    Contraseña actual para confirmar
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="origami-field"
                  />
                </div>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={
                  isSubmittingEmail ||
                  (isAwaitingOtp && otpCode.trim().length < 6)
                }
                className="origami-button"
              >
                {isAwaitingOtp
                  ? isSubmittingEmail
                    ? "Confirmando…"
                    : "Confirmar nuevo correo"
                  : isSubmittingEmail
                    ? "Enviando…"
                    : "Solicitar cambio"}
              </button>
              <button
                type="button"
                disabled={isSubmittingEmail}
                onClick={cancelEmailChange}
                className="origami-button origami-button--secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
