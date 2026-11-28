"use client";

import React, { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Gamepad2,
  Home,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import { UpwardCompassEmblem } from "./landing/brand-emblem";
import { useQuery } from "@tanstack/react-query";
import { ConfirmDialog } from "./ui/modal";
import { usePathname } from "next/navigation";
import { logoutSharedDevice } from "../lib/auth-hygiene";
import {
  isLogoutPending,
  isPublicAppRoute,
  subscribeSessionEpoch,
} from "../lib/auth-session";
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isAttemptingFlush, setIsAttemptingFlush] = useState(false);
  const logoutPending = useSyncExternalStore(
    subscribeSessionEpoch,
    isLogoutPending,
    () => false,
  );

  const shouldFetchFlags =
    (gamesEnabled === undefined || extraContentEnabled === undefined) &&
    !logoutPending &&
    !isPublicAppRoute(pathname ?? "/");
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
    { label: "Inicio", href: "/inicio", icon: "🏠", TeensIcon: Home, ariaLabel: undefined },
    ...(gamesOn
      ? [{ label: "Juegos", href: "/juegos", icon: "🎮", TeensIcon: Gamepad2, ariaLabel: undefined }]
      : []),
    { label: "Progreso", href: "/progreso", icon: "⭐", TeensIcon: TrendingUp, ariaLabel: undefined },
    { label: "Feedback", href: "/feedback", icon: "💬", TeensIcon: MessageSquare, ariaLabel: undefined },
    ...(extraContentOn
      ? [
          {
            label: "Extra",
            href: "/extra",
            icon: "🔗",
            TeensIcon: ExternalLink,
            ariaLabel: "Contenido extra",
          },
        ]
      : []),
  ];

  const performLogout = () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    void (async () => {
      await logoutSharedDevice(undefined, { keepInMemoryLock: true });
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
      window.location.replace("/login");
    })();
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
  const trimmedName = studentName?.trim() || "";
  const firstName = trimmedName ? trimmedName.split(/\s+/)[0] : "Perfil";
  const profileInitial = (trimmedName[0] || "P").toUpperCase();

  return (
    <>
      <header
        className={`sticky top-0 z-40 w-full border-b backdrop-blur-sm ${
          isKids ? "kids-header" : "teens-header"
        }`}
      >
        <div className="student-header-inner mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="student-header-start flex items-center gap-6">
            <Link
              href="/inicio"
              className="student-brand flex items-center gap-2 min-h-[48px] min-w-[48px] text-xl font-bold tracking-tight focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-md"
            >
              <span
                className={`flex items-center justify-center rounded-xl font-black text-base shadow-sm ${
                  isKids ? "kids-emblem h-9 w-9" : "teens-emblem"
                }`}
              >
                <UpwardCompassEmblem size={isKids ? 28 : 26} />
              </span>
              <span className={isKids ? "text-amber-950 font-black" : "font-extrabold"}>
                Upward English
              </span>
              {!isKids && <span className="teens-badge">Teens</span>}
            </Link>

            <nav
              className="student-links flex items-center gap-1 sm:gap-2"
              aria-label="Navegación del estudiante"
            >
              {navItems.map((item) => {
                const isCurrent = pathname === item.href;
                const isActive = isCurrent || pathname.startsWith(item.href + "/");
                const TeensIcon = item.TeensIcon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.ariaLabel}
                    aria-current={isCurrent ? "page" : isActive ? "location" : undefined}
                    className={`flex items-center justify-center min-h-[48px] min-w-[48px] gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 ${
                      isKids ? "kids-nav-link" : "teens-nav-link"
                    }`}
                  >
                    {isKids ? (
                      <span className="text-base" aria-hidden="true">
                        {item.icon}
                      </span>
                    ) : (
                      <TeensIcon
                        size={19}
                        className="teens-nav-icon shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="student-header-actions flex items-center gap-3">
            {level && (
              <span
                className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isKids ? "kids-level" : "teens-level"
                }`}
              >
                Nivel {level}
              </span>
            )}

            <Link
              href="/perfil"
              className={`flex items-center justify-center min-h-[48px] min-w-[48px] gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all focus:outline-none focus:ring-2 ${
                isKids ? "kids-profile" : "teens-profile"
              }`}
              aria-current={pathname === "/perfil" ? "page" : undefined}
              aria-label={isKids ? (studentName ? `Perfil: ${studentName}` : "Perfil") : undefined}
            >
              {isKids ? (
                <>
                  <span className="text-sm" aria-hidden="true">
                    👤
                  </span>
                  <span className="hidden sm:inline-block max-w-[120px] truncate">
                    Perfil
                  </span>
                </>
              ) : (
                <>
                  <span className="teens-profile-initial" aria-hidden="true">
                    {profileInitial}
                  </span>
                  <span className="sr-only">Perfil: </span>
                  <span className="max-sm:sr-only max-w-[120px] truncate">
                    {firstName}
                  </span>
                </>
              )}
            </Link>

            <button
              type="button"
              onClick={handleLogoutClick}
              disabled={isLoggingOut || isAttemptingFlush}
              className={`inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:opacity-50 cursor-pointer ${
                isKids ? "kids-logout" : "teens-logout"
              }`}
            >
              {isLoggingOut
                ? "Saliendo…"
                : isAttemptingFlush
                  ? "Guardando…"
                  : "Salir"}
            </button>
          </div>
        </div>
      </header>
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
