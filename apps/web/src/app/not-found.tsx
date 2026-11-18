import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Compass, House } from "lucide-react";
import { SystemSheet } from "./origami-system-sheet";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

export default function NotFound() {
  return (
    <SystemSheet
      label="Error 404"
      title="¡Ups! Página no encontrada"
      description="Parece que te has desviado del camino o la página que buscas ya no existe o cambió de lugar."
      icon={<Compass />}
    >
      <Link href="/inicio" className="origami-button">
        <House aria-hidden="true" /> Ir al Inicio
      </Link>
      <Link href="/login" className="origami-button origami-button--secondary">
        Iniciar sesión
      </Link>
    </SystemSheet>
  );
}
