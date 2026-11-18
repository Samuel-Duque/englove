import React, { Suspense, type ReactNode } from "react";
import { ContextFooter } from "./origami-footer";
import { TeacherNav } from "./teacher-nav";

export function TeacherShell({
  children,
  teacherName,
}: {
  children: ReactNode;
  teacherName?: string;
}) {
  return (
    <div className="origami-shell origami-teacher-shell">
      <Suspense fallback={<div className="origami-role-header" />}>
        <TeacherNav teacherName={teacherName} />
      </Suspense>
      <main
        id="main-content"
        tabIndex={-1}
        className="origami-container min-w-0 space-y-8 py-8 outline-none"
      >
        {children}
      </main>
      <ContextFooter />
    </div>
  );
}
