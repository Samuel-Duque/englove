'use client';

import React, { useEffect, useState } from 'react';
import { StudentNav } from './student-nav';
import { apiFetch } from '../lib/api';
import type { StudentProfileView } from '@englove/shared';

interface StudentShellProps {
  children: React.ReactNode;
}

export function StudentShell({ children }: StudentShellProps) {
  const [profile, setProfile] = useState<StudentProfileView | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchMe() {
      try {
        const data = await apiFetch<StudentProfileView>('/api/v1/me');
        if (isMounted) {
          setProfile(data);
        }
      } catch {
        // Fallback to default kids theme if not loaded yet
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    fetchMe();
    return () => {
      isMounted = false;
    };
  }, []);

  const ageSegment = profile?.student?.ageSegment ?? 'kids';
  const isKids = ageSegment === 'kids';

  return (
    <div
      data-theme={ageSegment}
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        isKids
          ? 'bg-amber-50/40 text-amber-950 font-sans'
          : 'bg-zinc-950 text-zinc-100 font-sans'
      }`}
    >
      <StudentNav
        studentName={profile?.user.name}
        ageSegment={ageSegment}
        level={profile?.student?.level}
      />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="py-16 text-center text-sm opacity-60">
            Cargando tu espacio…
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
