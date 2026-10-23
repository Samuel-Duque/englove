import React, { Suspense } from 'react';
import { StudentShell } from '../../components/student-shell';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-amber-50/50" />}>
      <StudentShell>{children}</StudentShell>
    </Suspense>
  );
}
