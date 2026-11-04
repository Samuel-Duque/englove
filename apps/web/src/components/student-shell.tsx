'use client';

import React, { useEffect, useState } from 'react';
import { StudentNav } from './student-nav';
import { OfflineStatusBanner } from './offline-status-banner';
import { apiFetch } from '../lib/api';
import { purgeOtherUsersEntries } from '../lib/offline-queue';
import type { StudentProfileView } from '@englove/shared';

interface StudentShellProps {
  children: React.ReactNode;
}

export function StudentShell({ children }: StudentShellProps) {
  const [profile, setProfile] = useState<StudentProfileView | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchMe() {
      try {
        const data = await apiFetch<StudentProfileView>('/api/v1/me');
        if (isMounted) {
          setProfile(data);
          if (data?.user?.id) {
            void purgeOtherUsersEntries(data.user.id);
          }
        }
      } catch {
        // Fallback to default kids theme if not loaded yet
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
      <OfflineStatusBanner />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
