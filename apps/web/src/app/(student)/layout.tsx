import React from 'react';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-amber-50/50" data-theme="kids">
      {/* Student portal scaffold layout */}
      {children}
    </div>
  );
}
