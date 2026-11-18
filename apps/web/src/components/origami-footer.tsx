import Link from "next/link";
import React from "react";
import { OrigamiBrand } from "./ui/origami-brand";

export function PublicFooter() {
  return (
    <footer className="origami-footer origami-shell">
      <div className="origami-container origami-footer__inner">
        <OrigamiBrand />
        <nav
          aria-label="Información y acceso"
          className="origami-footer__links"
        >
          <Link href="/terminos">Términos de uso</Link>
          <Link href="/login">Iniciar sesión</Link>
          <Link href="/registro">Crear cuenta</Link>
        </nav>
      </div>
    </footer>
  );
}

export function ContextFooter() {
  return (
    <footer className="origami-footer origami-footer--context origami-shell">
      <div className="origami-container origami-footer__inner">
        <span>Upward English</span>
      </div>
    </footer>
  );
}
