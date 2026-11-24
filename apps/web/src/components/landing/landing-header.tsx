'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { UpwardCompassEmblem } from './brand-emblem';

const NAV_ITEMS = [
  { href: '#que-es', label: 'Qué es' },
  { href: '#juegos', label: 'Juegos' },
  { href: '#personalizada', label: 'Personalizada' },
  { href: '#como-funciona', label: 'Cómo empezar' },
] as const;

/**
 * Cabecera pública sticky con navegación por anclas y menú móvil accesible (Bloque 1).
 */
export function LandingHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const wideViewportMedia = window.matchMedia('(min-width: 681px)');
    const handleMediaChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsMenuOpen(false);
      }
    };

    wideViewportMedia.addEventListener('change', handleMediaChange);
    return () => {
      wideViewportMedia.removeEventListener('change', handleMediaChange);
    };
  }, []);

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="brand-link" onClick={closeMenu}>
          <span className="brand-emblem" aria-hidden="true">
            <UpwardCompassEmblem size={28} />
          </span>
          <span>
            <span className="brand-name">Upward English</span>
          </span>
        </Link>

        <nav className="header-nav" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="header-actions">
          <Link href="/login" className="btn btn--surface">
            Entrar
          </Link>
          <Link href="/registro" className="btn btn--orange">
            Crear mi cuenta
          </Link>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          id="mobile-menu-btn"
          className="menu-toggle-btn"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu-panel"
          aria-label={
            isMenuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'
          }
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            {isMenuOpen ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      <nav
        id="mobile-menu-panel"
        className="mobile-menu-panel"
        aria-label="Menú móvil"
        hidden={!isMenuOpen}
      >
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="mobile-nav-link"
            onClick={closeMenu}
          >
            {item.label}
          </a>
        ))}
        <div className="mobile-menu-actions">
          <Link href="/login" className="btn btn--surface" onClick={closeMenu}>
            Entrar
          </Link>
          <Link href="/registro" className="btn btn--orange" onClick={closeMenu}>
            Crear mi cuenta
          </Link>
        </div>
      </nav>
    </header>
  );
}
