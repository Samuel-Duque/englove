import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aprende inglés jugando',
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50/70 via-white to-amber-50/40 flex flex-col justify-between p-6 sm:p-10">
      {/* Top Bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between pb-6 border-b border-amber-200/60">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-white text-xl shadow-xs">
            ⭐
          </span>
          <span className="text-xl font-black text-amber-950 tracking-tight">Englove</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs sm:text-sm font-extrabold text-amber-950/80 hover:text-amber-950 px-4 py-2 rounded-xl transition-colors"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className="text-xs sm:text-sm font-extrabold bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl shadow-xs transition-all"
          >
            Registrarse
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl w-full mx-auto my-auto py-12 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
          <span>🚀</span>
          <span>Aprender inglés nunca fue tan divertido</span>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-amber-950 tracking-tight leading-tight">
          Aprende inglés jugando, superando misiones y ganando medallas
        </h1>

        <p className="text-base sm:text-lg text-zinc-600 max-w-2xl mx-auto leading-relaxed">
          Plataforma educativa interactiva diseñada especialmente para niños y adolescentes (7 a 14 años).
          Microjuegos, práctica oral con audio y seguimiento continuo para profesores y alumnos.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="w-full sm:w-auto min-h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black px-8 py-3.5 text-base shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>🎮</span>
            <span>Entrar a mi portal</span>
          </Link>
          <Link
            href="/registro"
            className="w-full sm:w-auto min-h-12 rounded-2xl border-2 border-amber-300 hover:border-amber-400 bg-white text-amber-950 font-black px-8 py-3.5 text-base shadow-xs transition-all flex items-center justify-center"
          >
            Crear cuenta de estudiante
          </Link>
        </div>

        {/* Highlight Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-10 text-left">
          <div className="p-5 rounded-2xl bg-white border border-amber-200 shadow-xs space-y-2">
            <span className="text-2xl">🧸 / 🎧</span>
            <h3 className="font-extrabold text-amber-950 text-sm">Temas Kids y Teens</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Interfaces adaptadas a la edad: lúdica y colorida para los más pequeños, sobria para adolescentes.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-amber-200 shadow-xs space-y-2">
            <span className="text-2xl">🎙️</span>
            <h3 className="font-extrabold text-amber-950 text-sm">Speaking y Escucha</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Práctica de pronunciación guiada con grabación de voz y retroalimentación personalizada de tus docentes.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-amber-200 shadow-xs space-y-2">
            <span className="text-2xl">🏆</span>
            <h3 className="font-extrabold text-amber-950 text-sm">Gamificación Real</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Insignias desbloqueables, rachas semanales con escudos de perdón y estrellas de logro por actividad.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-amber-200/60 text-center text-xs text-zinc-400">
        <p>© 2026 Englove. Plataforma educativa de enseñanza de inglés.</p>
      </footer>
    </main>
  );
}
