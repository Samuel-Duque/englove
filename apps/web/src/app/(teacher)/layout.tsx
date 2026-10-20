import React from 'react';

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      {/* Teacher panel scaffold layout */}
      {children}
    </div>
  );
}
