"use client";

import React, { useTransition, useState } from "react";
import {
  BookOpen,
  ChartColumn,
  Gamepad2,
  House,
  LogOut,
  MessageSquare,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ConfirmDialog } from "./ui/modal";
import { usePathname } from "next/navigation";
import { AppearanceSelector } from "./appearance-selector";
import { OrigamiBrand } from "./ui/origami-brand";
import { logoutSharedDevice } from "../lib/auth-hygiene";
import { fetchSharedFeatureFlags } from "../lib/feature-flags-client";
import {
  hasPendingWork,
  getOfflineUserId,
  triggerFlush,
} from "../lib/offline-queue";

interface StudentNavProps {
  studentName?: string;
  ageSegment?: "kids" | "teens";
  level?: string | null;
  gamesEnabled?: boolean;
  extraContentEnabled?: boolean;
}

export function StudentNav({
  studentName,
  ageSegment = "kids",
  level,
  gamesEnabled,
  extraContentEnabled,
}: StudentNavProps) {
  const pathname = usePathname();
  const [isLoggingOut, startLogout] = useTransition();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isAttemptingFlush, setIsAttemptingFlush] = useState(false);

  const shouldFetchFlags =
    gamesEnabled === undefined || extraContentEnabled === undefined;
  const featureFlagsQuery = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => fetchSharedFeatureFlags(),
    enabled: shouldFetchFlags,
    retry: false,
  });

  const gamesOn = gamesEnabled ?? Boolean(featureFlagsQuery.data?.flags?.games);
  const extraContentOn =
    extraContentEnabled ??
    Boolean(featureFlagsQuery.data?.flags?.extra_content);

  const navItems = [
    { label: "Inicio", href: "/inicio", Icon: House },
    ...(gamesOn ? [{ label: "Juegos", href: "/juegos", Icon: Gamepad2 }] : []),
    { label: "Progreso", href: "/progreso", Icon: ChartColumn },
    { label: "Feedback", href: "/feedback", Icon: MessageSquare },
    ...(extraContentOn
      ? [{ label: "Extra", href: "/extra", Icon: BookOpen }]
      : []),
  ];

  const performLogout = () => {
    startLogout(async () => {
      await logoutSharedDevice();
      window.location.href = "/login";
    });
  };

  const handleLogoutClick = async () => {
    const hasPending = await hasPendingWork(getOfflineUserId() ?? "");
    if (!hasPending) {
      performLogout();
      return;
    }

    // Try to flush for up to 10 seconds if online (RF-18)
    if (typeof navigator !== "undefined" && navigator.onLine) {
      setIsAttemptingFlush(true);
      await Promise.race([
        triggerFlush(getOfflineUserId() ?? ""),
        new Promise((resolve) => setTimeout(resolve, 10000)),
      ]);
      setIsAttemptingFlush(false);
    }

    const stillPending = await hasPendingWork(getOfflineUserId() ?? "");
    if (stillPending) {
      setShowExitConfirm(true);
    } else {
      performLogout();
    }
  };

  const isKids = ageSegment === "kids";

  return (
    <>
      <header className="origami-role-header origami-shell">
        <div className="origami-container origami-container--student origami-role-header__inner">
          <Link className="origami-brand-link" href="/inicio">
            <OrigamiBrand />
          </Link>
          {level && (
            <span className="hidden text-sm font-bold lg:block">
              Nivel {level}
            </span>
          )}
          <div className="origami-header-actions">
            <AppearanceSelector authenticated />
            <Link
              href="/perfil"
              aria-label={studentName ? `Perfil: ${studentName}` : "Perfil"}
              aria-current={pathname === "/perfil" ? "page" : undefined}
              className={`origami-button origami-button--secondary origami-icon-action${pathname === "/perfil" ? " origami-selected" : ""}`}
            >
              <UserRound aria-hidden="true" />
              <span className="origami-wide-action">Perfil</span>
            </Link>
            <button
              type="button"
              onClick={handleLogoutClick}
              disabled={isLoggingOut || isAttemptingFlush}
              aria-label={
                isLoggingOut
                  ? "Saliendo…"
                  : isAttemptingFlush
                    ? "Guardando…"
                    : "Cerrar sesión"
              }
              className="origami-button origami-button--secondary origami-icon-action"
            >
              <LogOut aria-hidden="true" />
              <span className="origami-wide-action">
                {isLoggingOut
                  ? "Saliendo…"
                  : isAttemptingFlush
                    ? "Guardando…"
                    : "Cerrar sesión"}
              </span>
            </button>
          </div>
        </div>
      </header>
      <nav
        className="origami-student-nav origami-shell"
        aria-label="Navegación del estudiante"
      >
        <div className="origami-container origami-container--student origami-student-nav__items">
          {navItems.map(({ Icon, label, href }) => {
            const current = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-label={href === "/extra" ? "Contenido extra" : undefined}
                aria-current={current ? "page" : undefined}
                className={`origami-area-link${current ? " origami-selected" : ""}`}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <ConfirmDialog
        isOpen={showExitConfirm}
        title={
          isKids ? "¿Seguro que quieres salir?" : "Confirmar cierre de sesión"
        }
        message={
          isKids
            ? "Tienes trabajo sin enviar. Si sales ahora se perderá."
            : "Tienes respuestas sin enviar. Si sales ahora se perderán."
        }
        confirmText="Salir de todos modos"
        cancelText="Quedarme"
        isDestructive={true}
        onConfirm={() => {
          setShowExitConfirm(false);
          performLogout();
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </>
  );
}
