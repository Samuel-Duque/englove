"use client";

import React, { useTransition, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ConfirmDialog } from "./ui/modal";
import { usePathname } from "next/navigation";
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
    { label: "Inicio", href: "/inicio", icon: "🏠", ariaLabel: undefined },
    ...(gamesOn
      ? [{ label: "Juegos", href: "/juegos", icon: "🎮", ariaLabel: undefined }]
      : []),
    { label: "Progreso", href: "/progreso", icon: "⭐", ariaLabel: undefined },
    { label: "Feedback", href: "/feedback", icon: "💬", ariaLabel: undefined },
    ...(extraContentOn
      ? [
          {
            label: "Extra",
            href: "/extra",
            icon: "🔗",
            ariaLabel: "Contenido extra",
          },
        ]
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
    <header
      className={`sticky top-0 z-40 w-full border-b backdrop-blur-sm ${
        isKids
          ? "border-amber-200 bg-amber-50/95 text-amber-950"
          : "border-zinc-800 bg-zinc-900/95 text-zinc-100"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link
            href="/inicio"
            className="flex items-center gap-2 min-h-[48px] min-w-[48px] text-xl font-bold tracking-tight focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-md"
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl font-black text-base shadow-sm ${
                isKids ? "bg-amber-500 text-white" : "bg-indigo-600 text-white"
              }`}
            >
              🌟
            </span>
            <span
              className={
                isKids
                  ? "text-amber-950 font-black"
                  : "text-zinc-100 font-black"
              }
            >
              Englove
            </span>
          </Link>

          <nav
            className="flex items-center gap-1 sm:gap-2"
            aria-label="Navegación del estudiante"
          >
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.ariaLabel}
                  className={`flex items-center justify-center min-h-[48px] min-w-[48px] gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 ${
                    isActive
                      ? isKids
                        ? "bg-amber-200/80 text-amber-950 shadow-xs"
                        : "bg-zinc-800 text-white shadow-xs"
                      : isKids
                        ? "text-amber-950 font-medium hover:bg-amber-100"
                        : "text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100"
                  }`}
                >
                  <span className="text-base" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {level && (
            <span
              className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isKids
                  ? "bg-amber-200 text-amber-900"
                  : "bg-indigo-950 text-indigo-300 border border-indigo-800"
              }`}
            >
              Nivel {level}
            </span>
          )}

          <Link
            href="/perfil"
            className={`flex items-center justify-center min-h-[48px] min-w-[48px] gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all focus:outline-none focus:ring-2 ${
              pathname === "/perfil"
                ? isKids
                  ? "bg-amber-200 text-amber-950 ring-2 ring-amber-400"
                  : "bg-zinc-800 text-white ring-2 ring-indigo-500"
                : isKids
                  ? "bg-amber-100/80 hover:bg-amber-200 text-amber-900"
                  : "bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200"
            }`}
            aria-label={studentName ? `Perfil: ${studentName}` : "Perfil"}
          >
            <span className="text-sm" aria-hidden="true">
              👤
            </span>
            <span className="hidden sm:inline-block max-w-[120px] truncate">
              {studentName || "Perfil"}
            </span>
          </Link>

          <button
            type="button"
            onClick={handleLogoutClick}
            disabled={isLoggingOut || isAttemptingFlush}
            className={`inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:opacity-50 cursor-pointer ${
              isKids
                ? "bg-amber-200/60 hover:bg-amber-200 text-amber-950"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            }`}
          >
            {isLoggingOut
              ? "Saliendo…"
              : isAttemptingFlush
                ? "Guardando…"
                : "Cerrar sesión"}
          </button>
        </div>
      </div>

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
    </header>
  );
}
