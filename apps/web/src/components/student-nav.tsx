import React, { useTransition, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clearSharedDeviceSession } from '../lib/auth-hygiene';
import {
  hasPendingWork,
  triggerFlush,
  clearOfflineQueue,
} from '../lib/offline-queue';

interface StudentNavProps {
  studentName?: string;
  ageSegment?: 'kids' | 'teens';
  level?: string | null;
  gamesEnabled?: boolean;
}

export function StudentNav({ studentName, ageSegment = 'kids', level, gamesEnabled }: StudentNavProps) {
  const pathname = usePathname();
  const [isLoggingOut, startLogout] = useTransition();
  const [gamesOn, setGamesOn] = React.useState(gamesEnabled ?? false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isAttemptingFlush, setIsAttemptingFlush] = useState(false);

  React.useEffect(() => {
    if (gamesEnabled !== undefined) {
      setGamesOn(gamesEnabled);
      return;
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    fetch(`${apiUrl}/api/v1/feature-flags`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.flags?.games !== undefined) {
          setGamesOn(Boolean(data.flags.games));
        }
      })
      .catch(() => {});
  }, [gamesEnabled]);

  const navItems = [
    { label: 'Inicio', href: '/inicio', icon: '🏠' },
    ...(gamesOn ? [{ label: 'Juegos', href: '/juegos', icon: '🎮' }] : []),
    { label: 'Progreso', href: '/progreso', icon: '⭐' },
    { label: 'Feedback', href: '/feedback', icon: '💬' },
  ];

  const performLogout = () => {
    startLogout(async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        await fetch(`${apiUrl}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: window.location.origin,
          },
          credentials: 'include',
        });
      } catch {
        // Clear client state even on network error
      } finally {
        await clearOfflineQueue();
        await clearSharedDeviceSession();
        window.location.href = '/login';
      }
    });
  };

  const handleLogoutClick = async () => {
    const hasPending = await hasPendingWork();
    if (!hasPending) {
      performLogout();
      return;
    }

    // Try to flush for up to 10 seconds if online (RF-18)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setIsAttemptingFlush(true);
      await Promise.race([
        triggerFlush(),
        new Promise((resolve) => setTimeout(resolve, 10000)),
      ]);
      setIsAttemptingFlush(false);
    }

    const stillPending = await hasPendingWork();
    if (stillPending) {
      setShowExitConfirm(true);
    } else {
      performLogout();
    }
  };

  const isKids = ageSegment === 'kids';

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b backdrop-blur-sm ${
        isKids
          ? 'border-amber-200 bg-amber-50/95 text-amber-950'
          : 'border-zinc-800 bg-zinc-900/95 text-zinc-100'
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
                isKids
                  ? 'bg-amber-500 text-white'
                  : 'bg-indigo-600 text-white'
              }`}
            >
              🌟
            </span>
            <span className={isKids ? 'text-amber-900' : 'text-zinc-100'}>
              Englove
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Navegación del estudiante">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-center min-h-[48px] min-w-[48px] gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 ${
                    isActive
                      ? isKids
                        ? 'bg-amber-200/80 text-amber-950 shadow-xs'
                        : 'bg-zinc-800 text-white shadow-xs'
                      : isKids
                        ? 'text-amber-900/70 hover:bg-amber-100 hover:text-amber-950'
                        : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100'
                  }`}
                >
                  <span className="text-base" aria-hidden="true">{item.icon}</span>
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
                  ? 'bg-amber-200 text-amber-900'
                  : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
              }`}
            >
              Nivel {level}
            </span>
          )}

          <Link
            href="/perfil"
            className={`flex items-center justify-center min-h-[48px] min-w-[48px] gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all focus:outline-none focus:ring-2 ${
              pathname === '/perfil'
                ? isKids
                  ? 'bg-amber-200 text-amber-950 ring-2 ring-amber-400'
                  : 'bg-zinc-800 text-white ring-2 ring-indigo-500'
                : isKids
                  ? 'bg-amber-100/80 hover:bg-amber-200 text-amber-900'
                  : 'bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200'
            }`}
            aria-label="Ir a mi perfil"
          >
            <span className="text-sm" aria-hidden="true">👤</span>
            <span className="hidden sm:inline-block max-w-[120px] truncate">
              {studentName || 'Perfil'}
            </span>
          </Link>

          <button
            type="button"
            onClick={handleLogoutClick}
            disabled={isLoggingOut || isAttemptingFlush}
            className={`inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-xl px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:opacity-50 cursor-pointer ${
              isKids
                ? 'bg-amber-200/60 hover:bg-amber-200 text-amber-950'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
          >
            {isLoggingOut
              ? 'Saliendo…'
              : isAttemptingFlush
                ? 'Guardando…'
                : 'Cerrar sesión'}
          </button>
        </div>
      </div>

      {/* Confirmation Dialog when logout attempted with unsaved work (RF-18, §7) */}
      {showExitConfirm && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-zinc-200 p-6 text-zinc-900">
            <h3 className="text-lg font-bold mb-2 text-zinc-900">
              {isKids ? '¿Seguro que quieres salir?' : 'Confirmar cierre de sesión'}
            </h3>
            <p className="text-sm text-zinc-600 mb-6">
              {isKids
                ? 'Tienes trabajo sin enviar. Si sales ahora se perderá.'
                : 'Tienes respuestas sin enviar. Si sales ahora se perderán.'}
            </p>
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="w-full sm:w-auto inline-flex items-center justify-center min-h-[48px] min-w-[48px] px-5 py-2.5 rounded-xl border border-zinc-300 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
              >
                Quedarme
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false);
                  performLogout();
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center min-h-[48px] min-w-[48px] px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-sm font-bold text-white transition-colors cursor-pointer shadow-xs focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
              >
                Salir de todos modos
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
