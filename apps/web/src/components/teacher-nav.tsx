"use client";

import {
  BookOpen,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  House,
  LibraryBig,
  LogOut,
  Menu,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { logoutSharedDevice } from "../lib/auth-hygiene";
import { AppearanceSelector } from "./appearance-selector";
import { OrigamiBrand } from "./ui/origami-brand";

const areas = [
  { label: "Inicio", href: "/inicio", Icon: House },
  { label: "Actividades", href: "/actividades", Icon: BookOpen },
  { label: "Asignaciones", href: "/asignaciones", Icon: ClipboardList },
  { label: "Revisión", href: "/revision", Icon: ClipboardCheck },
  { label: "Estadísticas", href: "/estadisticas", Icon: ChartColumn },
  { label: "Grupos", href: "/grupos", Icon: Users },
  { label: "Alumnos", href: "/alumnos", Icon: UserRound },
  { label: "Contenido extra", href: "/contenido-extra", Icon: LibraryBig },
];

function TeacherAreas({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación principal" className="origami-teacher-areas">
      {areas.map(({ href, label, Icon }) => {
        const current = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={current ? "page" : undefined}
            className={`origami-area-link${current ? " origami-selected" : ""}`}
          >
            <Icon size={24} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TeacherNav({ teacherName }: { teacherName?: string }) {
  const [isLoggingOut, startLogout] = useTransition();
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onResize = () => {
      if (desktop.matches) dialog.current?.close();
    };
    desktop.addEventListener("change", onResize);
    return () => desktop.removeEventListener("change", onResize);
  }, []);

  const handleLogout = () => {
    startLogout(async () => {
      await logoutSharedDevice();
      window.location.href = "/login";
    });
  };

  return (
    <>
      <header className="origami-role-header origami-shell">
        <div className="origami-container origami-role-header__inner">
          <Link className="origami-brand-link" href="/inicio">
            <OrigamiBrand />
          </Link>
          {teacherName && (
            <span className="hidden min-w-0 truncate text-sm lg:block">
              {teacherName}
            </span>
          )}
          <div className="origami-header-actions">
            <AppearanceSelector authenticated />
            <button
              type="button"
              className="origami-button origami-button--secondary origami-icon-action"
              aria-label={isLoggingOut ? "Cerrando…" : "Cerrar sesión"}
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              <LogOut aria-hidden="true" />
              <span className="origami-wide-action">
                {isLoggingOut ? "Cerrando…" : "Cerrar sesión"}
              </span>
            </button>
            <button
              type="button"
              ref={menuButton}
              className="origami-button origami-button--secondary origami-icon-action origami-teacher-menu"
              aria-label="Abrir menú principal"
              aria-controls={dialogId}
              aria-expanded={open}
              onClick={() => {
                dialog.current?.showModal();
                setOpen(true);
              }}
            >
              <Menu aria-hidden="true" />
            </button>
          </div>
        </div>
        <dialog
          id={dialogId}
          ref={dialog}
          className="origami-teacher-drawer"
          aria-labelledby={`${dialogId}-label`}
          onClose={() => {
            setOpen(false);
            menuButton.current?.focus();
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id={`${dialogId}-label`} className="origami-card-title">
              Menú principal
            </h2>
            <button
              type="button"
              className="origami-button origami-button--text origami-icon-action"
              aria-label="Cerrar menú principal"
              onClick={() => dialog.current?.close()}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <TeacherAreas onNavigate={() => dialog.current?.close()} />
        </dialog>
      </header>
      <aside className="origami-teacher-sidebar origami-shell">
        <TeacherAreas />
      </aside>
    </>
  );
}
