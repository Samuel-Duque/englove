'use client';

import React, { useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clearSharedDeviceSession } from '../lib/auth-hygiene';

interface StudentNavProps {
  studentName?: string;
  ageSegment?: 'kids' | 'teens';
  level?: string | null;
}

export function StudentNav({ studentName, ageSegment = 'kids', level }: StudentNavProps) {
  const pathname = usePathname();
  const [isLoggingOut, startLogout] = useTransition();

  const navItems = [
    { label: 'Inicio', href: '/inicio', icon: '🏠' },
    { label: 'Progreso', href: '/progreso', icon: '⭐' },
  ];

  const handleLogout = () => {
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
        await clearSharedDeviceSession();
        window.location.href = '/login';
      }
    });
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
            className="flex items-center gap-2 text-xl font-bold tracking-tight focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-md"
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
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 ${
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
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all focus:outline-none focus:ring-2 ${
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
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 ${
              isKids
                ? 'bg-amber-200/60 hover:bg-amber-200 text-amber-950'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
          >
            {isLoggingOut ? 'Saliendo…' : 'Cerrar sesión'}
          </button>
        </div>
      </div>
    </header>
  );
}
