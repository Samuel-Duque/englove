import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Términos y Condiciones',
  description: 'Términos y condiciones de uso de la plataforma educativa Englove.',
};

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-12 rounded-3xl border border-zinc-200 shadow-sm space-y-8">
        <header className="border-b border-zinc-200 pb-6">
          <Link
            href="/login"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 mb-4"
          >
            ← Volver al inicio
          </Link>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">
            Términos y Condiciones de Uso
          </h1>
          <p className="text-sm text-zinc-500 mt-2">
            Versión v1.0 — Vigente para el entorno educativo de Englove
          </p>
        </header>

        <section className="space-y-4 text-zinc-700 leading-relaxed text-sm sm:text-base">
          <h2 className="text-xl font-bold text-zinc-900">1. Propósito de la Plataforma</h2>
          <p>
            Englove es una plataforma educativa diseñada para facilitar la enseñanza y aprendizaje
            del idioma inglés en niños y adolescentes mediante actividades pedagógicas gamificadas,
            supervisadas por docentes.
          </p>

          <h2 className="text-xl font-bold text-zinc-900">2. Registro y Aprobación de Cuentas</h2>
          <p>
            El registro de estudiantes requiere la autorización de un acudiente o tutor legal. Toda
            cuenta de estudiante nueva permanece en estado pendiente de aprobación hasta que la
            docente a cargo valida los datos y asigna el nivel y grupo correspondiente.
          </p>

          <h2 className="text-xl font-bold text-zinc-900">3. Privacidad y Protección de Datos</h2>
          <p>
            En cumplimiento de la legislación de protección de datos personales de menores de edad,
            la información recopilada se utiliza exclusivamente con fines educativos, de seguimiento
            pedagógico y evaluación del progreso académico. No se comparten datos con terceros ni se
            utilizan para fines publicitarios o comerciales.
          </p>

          <h2 className="text-xl font-bold text-zinc-900">4. Grabaciones de Audio y Material Educativo</h2>
          <p>
            Las actividades de pronunciación y expresión oral (speaking) implican la grabación de
            audio. Estas grabaciones se almacenan de forma segura para permitir la retroalimentación
            docente y el análisis de pronunciación del alumno.
          </p>

          <h2 className="text-xl font-bold text-zinc-900">5. Uso Responsable</h2>
          <p>
            Los estudiantes y docentes se comprometen a hacer un uso respetuoso y constructivo de las
            herramientas de la plataforma. La docente se reserva el derecho de administrar o suspender
            accesos ante cualquier uso indebido de las cuentas o materiales.
          </p>
        </section>

        <footer className="pt-6 border-t border-zinc-200 flex flex-wrap gap-4 items-center justify-between text-sm text-zinc-500">
          <span>Englove — Plataforma Educativa de Inglés</span>
          <div className="flex gap-4">
            <Link href="/registro" className="text-blue-600 hover:underline font-medium">
              Ir a Registro
            </Link>
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              Iniciar Sesión
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
