'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, ChartNoAxesColumn, ClipboardList, FileCheck, House, LibraryBig, LogOut, Menu, Users, UsersRound, X } from 'lucide-react';
import { logoutSharedDevice } from '../lib/auth-hygiene';
import { UpwardCompassEmblem } from './landing/brand-emblem';
import styles from './teacher-portal.module.css';

export const teacherDestinations = [
  { label: 'Inicio', href: '/inicio', icon: House, description: '' },
  { label: 'Actividades', href: '/actividades', icon: BookOpen, description: 'Consulta y organiza el catálogo de actividades.' },
  { label: 'Asignaciones', href: '/asignaciones', icon: ClipboardList, description: 'Programa tareas y consulta sus entregas.' },
  { label: 'Revisión', href: '/revision', icon: FileCheck, description: 'Revisa respuestas y califica entregas.' },
  { label: 'Alumnos', href: '/alumnos', icon: Users, description: 'Gestiona alumnos y solicitudes de registro.' },
  { label: 'Grupos', href: '/grupos', icon: UsersRound, description: 'Organiza tus grupos y sus integrantes.' },
  { label: 'Estadísticas', href: '/estadisticas', icon: ChartNoAxesColumn, description: 'Consulta el rendimiento y la constancia.' },
  { label: 'Contenido extra', href: '/contenido-extra', icon: LibraryBig, description: 'Administra recursos complementarios.' },
];

const navGroups = [
  { label: 'Docencia', items: teacherDestinations.slice(0, 4) },
  { label: 'Gestión y seguimiento', items: teacherDestinations.slice(4) },
];

const childLabels: Readonly<Record<string, string>> = {
  '/actividades/nueva': 'Nueva actividad',
  '/asignaciones/nueva': 'Nueva asignación',
  '/alumnos/bloqueados': 'Cuentas bloqueadas',
};

export function TeacherBreadcrumbs() {
  const pathname = usePathname();
  const parent = teacherDestinations.find(({ href }) => pathname.startsWith(`${href}/`));
  if (!parent) return <span>Panel Docente</span>;

  return (
    <nav aria-label="Ruta actual" className={styles.breadcrumbs}>
      <Link href={parent.href} className={styles.actionLink}>{parent.label}</Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{childLabels[pathname] ?? 'Detalle'}</span>
    </nav>
  );
}

export function TeacherNav({ teacherName }: { teacherName?: string }) {
  const pathname = usePathname();
  const panelId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const isOpen = openPath === pathname;
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  function closeMenu() {
    setOpenPath(null);
  }

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await logoutSharedDevice(undefined, { keepInMemoryLock: true });
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
    window.location.replace('/login');
  }

  return (
    <header className={styles.sidebar} onKeyDown={(event) => {
      if (event.key === 'Escape' && isOpen && menuButton.current?.getClientRects().length) {
        closeMenu();
        menuButton.current.focus();
      }
    }}>
      <div className={styles.sidebarHeader}>
        <Link href="/inicio" className={styles.brand} onClick={closeMenu}>
          <span className={styles.emblem}><UpwardCompassEmblem size={28} /></span>
          <span className={styles.brandText}><strong>Upward English</strong><small>Panel Docente</small></span>
        </Link>
        <button
          ref={menuButton}
          type="button"
          className={styles.menuButton}
          aria-label="Menú docente"
          aria-controls={panelId}
          aria-expanded={isOpen}
          onClick={() => setOpenPath(isOpen ? null : pathname)}
        >
          {isOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </div>

      <div id={panelId} className={styles.navPanel} data-open={isOpen}>
        <nav aria-label="Navegación docente" className={styles.navigation}>
          {navGroups.map(({ label, items }) => (
            <div key={label} role="group" aria-label={label}>
              <p className={styles.navLabel}>{label}</p>
              <ul className={styles.navList}>
                {items.map(({ label: itemLabel, href, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      className={styles.navLink}
                      href={href}
                      onClick={closeMenu}
                      aria-current={pathname === href ? 'page' : pathname.startsWith(`${href}/`) ? 'location' : undefined}
                    >
                      <Icon size={19} strokeWidth={1.65} aria-hidden="true" />{itemLabel}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <p>{teacherName || 'Profesora'}</p>
          <button type="button" className={styles.secondaryButton} disabled={isLoggingOut} onClick={() => {
            void handleLogout();
          }}>
            <LogOut size={18} strokeWidth={1.65} aria-hidden="true" />
            {isLoggingOut ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
        </div>
      </div>
    </header>
  );
}
