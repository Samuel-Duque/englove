import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Página no encontrada',
};

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-gradient-to-b from-amber-50/60 to-white flex items-center justify-center p-6 text-center outline-none">
      <div className="max-w-md w-full bg-white rounded-3xl border border-amber-200/80 p-8 sm:p-10 shadow-lg space-y-6">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-100 text-4xl shadow-inner mx-auto">
          🧭
        </div>

        <div className="space-y-2">
          <span className="text-xs font-black uppercase tracking-widest text-amber-700 bg-amber-100/80 px-3 py-1 rounded-full">
            Error 404
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-amber-950 tracking-tight">
            ¡Ups! Página no encontrada
          </h1>
          <p className="text-sm text-zinc-600 leading-relaxed max-w-sm mx-auto">
            Parece que te has desviado del camino o la página que buscas ya no existe o cambió de lugar.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/inicio"
            className="rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-6 py-3 text-sm shadow-sm transition-all"
          >
            🏠 Ir al Inicio
          </Link>
          <Link
            href="/login"
            className="rounded-2xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-bold px-5 py-3 text-sm transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </main>
  );
}
