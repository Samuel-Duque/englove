'use client';

import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StudentNav } from './student-nav';
import { OfflineStatusBanner } from './offline-status-banner';
import { fetchSharedProfile } from '../lib/auth-session';
import { purgeOtherUsersEntries } from '../lib/offline-queue';

interface StudentShellProps {
  children: React.ReactNode;
}

export function StudentShell({ children }: StudentShellProps) {
  const { data: profile = null } = useQuery({
    queryKey: ['student', 'profile', 'shell'],
    queryFn: () => fetchSharedProfile(),
    retry: false,
  });

  useEffect(() => {
    if (profile?.user?.id) {
      void purgeOtherUsersEntries(profile.user.id);
    }
  }, [profile?.user?.id]);

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
      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 outline-none">
        {children}
      </main>
    </div>
  );
}
