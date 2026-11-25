import React, { Suspense } from 'react';
import { TeacherShell } from '../../components/teacher-shell';

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TeacherShell>
      <Suspense fallback={<div className="py-12 text-center text-sm">Cargando…</div>}>
        {children}
      </Suspense>
    </TeacherShell>
  );
}
