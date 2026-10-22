import React, { Suspense } from 'react';
import { TeacherNav } from '../../components/teacher-nav';

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      <Suspense fallback={<header className="h-16 border-b border-zinc-200 bg-white" />}>
        <TeacherNav />
      </Suspense>
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<div className="py-12 text-center text-zinc-500 text-sm">Cargando…</div>}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
