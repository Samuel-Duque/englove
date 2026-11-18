"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getAuthErrorMessage } from "../../../lib/auth-errors";
import {
  setSharedSession,
  requestSharedRefresh,
  clearSharedProfile,
  isLogoutPending,
} from "../../../lib/auth-session";
import { reconcilePendingLogout } from "../../../lib/auth-hygiene";
import { clearSharedFeatureFlags } from "../../../lib/feature-flags-client";
import { purgeOtherUsersEntries } from "../../../lib/offline-queue";
import { getQueryClient } from "../../../lib/query-client";
import type { SessionView } from "@upward-english/shared";
import { AccessLoading, AccessSheet } from "../access-sheet";
import styles from "../public-origami.module.css";

function isSafeNextDestination(next: string | null | undefined): boolean {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\")
  ) {
    return false;
  }
  const hasControlChars = Array.from(next).some((c) => {
    const code = c.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (hasControlChars) {
    return false;
  }
  const isPublicAuthRoute =
    next.startsWith("/login") ||
    next.startsWith("/registro") ||
    next.startsWith("/recuperar-contrasena") ||
    next.startsWith("/restablecer");
  return !isPublicAuthRoute;
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams?.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // Silent refresh check on load via useQuery (RF-17, §7, H12, QA-04)
  const { isLoading: isCheckingSession } = useQuery({
    queryKey: ["auth", "silent-refresh", nextParam],
    queryFn: async () => {
      if (isLogoutPending()) {
        const confirmed = await reconcilePendingLogout();
        setErrorMessage(
          confirmed
            ? null
            : "No se pudo confirmar el cierre de sesión. Reintenta cuando haya conexión; la cuenta anterior permanece bloqueada en este dispositivo.",
        );
        return false;
      }
      // Only attempt silent refresh if there is an active session hint (QA-02, P0-02)
      const hasSessionHint =
        typeof window !== "undefined" &&
        document.cookie.split(";").some((c) => {
          const [key, val] = c.split("=").map((s) => s.trim());
          return (
            (key === "session_hint" ||
              key?.endsWith("_session_hint") ||
              key?.includes("session_hint")) &&
            val === "1"
          );
        });

      if (!hasSessionHint) {
        return false;
      }

      try {
        const refreshed = await requestSharedRefresh();
        if (refreshed) {
          const destination =
            nextParam && isSafeNextDestination(nextParam)
              ? nextParam
              : "/inicio";
          router.replace(destination);
          return true;
        }
      } catch {
        // Fallback: stay on login page
      }

      return false;
    },
    staleTime: Infinity,
    refetchInterval: () => (isLogoutPending() ? 10000 : false),
    refetchOnWindowFocus: true,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({
      emailVal,
      passwordVal,
    }: {
      emailVal: string;
      passwordVal: string;
    }) => {
      if (isLogoutPending() && !(await reconcilePendingLogout())) {
        throw new Error(
          "No se pudo confirmar el cierre de la sesión anterior. Reintenta cuando haya conexión.",
        );
      }
      const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify({ email: emailVal, password: passwordVal }),
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

      const session: SessionView = await res.json();
      return session;
    },
    onSuccess: async (data) => {
      // RF-5 / ISSUE-09 hygiene: Purge offline queue events from any other user
      if (data.user?.id) {
        await purgeOtherUsersEntries(data.user.id).catch((purgeErr) => {
          console.warn("[Login] Offline queue purge notice:", purgeErr);
        });
      }

      setSharedSession(data);
      clearSharedProfile();
      clearSharedFeatureFlags();

      // Reset query cache to avoid showing stale data from previous user
      getQueryClient().clear();

      // Redirection
      const destination =
        nextParam && isSafeNextDestination(nextParam) ? nextParam : "/inicio";
      router.push(destination);
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
    loginMutation.mutate({ emailVal: email, passwordVal: password });
  };

  if (isCheckingSession) {
    return <AccessLoading>Comprobando tu sesión…</AccessLoading>;
  }

  return (
    <AccessSheet>
      <header className={styles.intro}>
        <h1 className="origami-page-title">Upward English</h1>
        <p className="origami-meta">
          Aprende inglés jugando con tu profesora y compañeros.
        </p>
      </header>

      {errorMessage && (
        <div role="alert" className="origami-state origami-state--error">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
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
            placeholder="tu-correo@ejemplo.com"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="password-input" className="origami-label">
            Contraseña
          </label>
          <input
            id="password-input"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="origami-field"
            placeholder="••••••••"
          />
          <Link href="/recuperar-contrasena" className={styles.textLink}>
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="origami-button"
        >
          {loginMutation.isPending ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <div className={`origami-meta ${styles.related}`}>
        ¿No tienes una cuenta de estudiante?{" "}
        <Link href="/registro" className={styles.textLink}>
          Regístrate aquí
        </Link>
      </div>

      {/* Development Quick Credentials Picker (P2-02, T2.1) */}
      {(process.env.NEXT_PUBLIC_APP_ENV === "local" ||
        process.env.APP_ENV === "local") && (
        <div className={styles.devCredentials}>
          <p className="origami-meta">Credenciales de prueba (Dev)</p>
          <div className={styles.field}>
            <button
              type="button"
              onClick={() => {
                setEmail("profesora@upwardenglish.org");
                setPassword("UpwardEnglish2026!");
                setErrorMessage(null);
              }}
              className={`origami-button origami-button--secondary ${styles.devButton}`}
            >
              <span>Docente Principal</span>
              <span className="origami-meta">profesora@upwardenglish.org</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail("lucas.kids@upwardenglish.org");
                setPassword("Estudiante2026!");
                setErrorMessage(null);
              }}
              className={`origami-button origami-button--secondary ${styles.devButton}`}
            >
              <span>Alumno (Kids)</span>
              <span className="origami-meta">lucas.kids@upwardenglish.org</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail("camila.teens@upwardenglish.org");
                setPassword("Estudiante2026!");
                setErrorMessage(null);
              }}
              className={`origami-button origami-button--secondary ${styles.devButton}`}
            >
              <span>Alumna (Teens)</span>
              <span className="origami-meta">
                camila.teens@upwardenglish.org
              </span>
            </button>
          </div>
        </div>
      )}
    </AccessSheet>
  );
}
