'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import type { StudentProfileView } from '@upward-english/shared';
import { useQuery } from '@tanstack/react-query';
import { StudentNav } from './student-nav';
import { OfflineStatusBanner } from './offline-status-banner';
import {
  fetchSharedProfile,
  isLogoutPending,
  subscribeSessionEpoch,
} from '../lib/auth-session';
import { purgeOtherUsersEntries } from '../lib/offline-queue';

interface StudentShellProps {
  children: React.ReactNode;
  profile?: StudentProfileView | null;
  ageSegment?: "kids" | "teens";
  studentName?: string;
}

export function StudentShell({ children, profile: providedProfile, ageSegment: providedTheme, studentName }: StudentShellProps) {
  const logoutPending = useSyncExternalStore(
    subscribeSessionEpoch,
    isLogoutPending,
    () => false,
  );
  const { data: fetchedProfile = null } = useQuery({
    queryKey: ['student', 'profile', 'shell'],
    queryFn: () => fetchSharedProfile(),
    retry: false,
    enabled: providedProfile === undefined && !logoutPending,
  });

  const profile = providedProfile === undefined ? fetchedProfile : providedProfile;

  useEffect(() => {
    if (profile?.user?.id) {
      void purgeOtherUsersEntries(profile.user.id);
    }
  }, [profile?.user?.id]);

  const ageSegment = providedTheme ?? profile?.student?.ageSegment ?? 'kids';
  const isKids = ageSegment === 'kids';

  return (
    <div
      data-theme={ageSegment}
      className={`student-shell min-h-screen flex flex-col transition-colors duration-200 ${
        isKids
          ? 'student-shell-kids'
          : 'student-shell-teens'
      }`}
    >
      <StudentNav
        studentName={studentName ?? profile?.user.name}
        ageSegment={ageSegment}
        level={profile?.student?.level}
      />
      <OfflineStatusBanner />
      <main id="main-content" tabIndex={-1} className="student-main flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 outline-none">
        {children}
      </main>
    </div>
  );
}
