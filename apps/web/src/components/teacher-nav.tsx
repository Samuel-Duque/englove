'use client';

import React, { useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clearSharedDeviceSession } from '../lib/auth-hygiene';

interface TeacherNavProps {
  teacherName?: string;
}

export function TeacherNav({ teacherName }: TeacherNavProps) {
  const pathname = usePathname();
  const [isLoggingOut, startLogout] = useTransition();

  const navItems = [
    { label: 'Inicio', href: '/inicio' },
    { label: 'Actividades', href: '/actividades' },
    { label: 'Asignaciones', href: '/asignaciones' },
    { label: 'Revisión', href: '/revision' },
    { label: 'Estadísticas', href: '/estadisticas' },
    { label: 'Grupos', href: '/grupos' },
    { label: 'Alumnos', href: '/alumnos' },
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
        // Continue even if network error
      } finally {
        await clearSharedDeviceSession();
        window.location.href = '/login';
      }
    });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link
            href="/inicio"
            className="flex items-center gap-2 text-xl font-bold tracking-tight text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-extrabold text-sm">
              E
            </span>
            <span>Englove</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Navegación principal">
            {navItems.map((item) => {
              const isActive =
                item.href === '/inicio'
                  ? pathname === '/inicio'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {teacherName && (
            <span className="hidden sm:inline-block text-xs font-medium text-zinc-600">
              {teacherName}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 transition-colors"
          >
            {isLoggingOut ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
        </div>
      </div>
      {/* Mobile nav bar */}
      <nav className="flex md:hidden border-t border-zinc-100 px-2 py-1 justify-around" aria-label="Navegación móvil">
        {navItems.map((item) => {
          const isActive =
            item.href === '/inicio'
              ? pathname === '/inicio'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-2 py-1.5 text-xs font-medium ${
                isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-zinc-600'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
