import React from 'react';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-xl p-8 bg-zinc-50 border border-zinc-200 rounded-2xl shadow-sm">
        <h1 className="text-3xl font-extrabold text-zinc-900 mb-3 tracking-tight">
          Englove — Plataforma en preparación
        </h1>
        <p className="text-zinc-600 mb-6 leading-relaxed">
          Base de infraestructura y scaffold completados. Las experiencias pedagógicas y de autenticación
          se habilitarán según el calendario de implementación.
        </p>
        <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          Etapa 1 — Scaffold
        </div>
      </div>
    </main>
  );
}
