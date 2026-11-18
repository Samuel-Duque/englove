"use client";

import React, { type ComponentProps, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { StudentNav } from "./student-nav";
import { OfflineStatusBanner } from "./offline-status-banner";
import { ContextFooter } from "./origami-footer";
import { fetchSharedProfile } from "../lib/auth-session";
import { purgeOtherUsersEntries } from "../lib/offline-queue";

interface StudentShellProps {
  children: React.ReactNode;
}

export function StudentShell({ children }: StudentShellProps) {
  const { data: profile = null } = useQuery({
    queryKey: ["student", "profile", "shell"],
    queryFn: () => fetchSharedProfile(),
    retry: false,
  });

  useEffect(() => {
    if (profile?.user?.id) {
      void purgeOtherUsersEntries(profile.user.id);
    }
  }, [profile?.user?.id]);

  return (
    <StudentFrame
      studentName={profile?.user.name}
      ageSegment={profile?.student?.ageSegment}
      level={profile?.student?.level}
    >
      {children}
    </StudentFrame>
  );
}

export function StudentFrame({
  children,
  ageSegment = "kids",
  ...nav
}: StudentShellProps & ComponentProps<typeof StudentNav>) {
  const isActivity = usePathname().startsWith("/actividad/");
  return (
    <div
      data-theme={ageSegment}
      className="origami-shell origami-student-frame min-h-screen flex flex-col"
    >
      <StudentNav ageSegment={ageSegment} {...nav} />
      <OfflineStatusBanner />
      <main
        id="main-content"
        tabIndex={-1}
        className="origami-container origami-container--student min-w-0 flex-1 space-y-8 py-6 outline-none"
      >
        {children}
      </main>
      {!isActivity && <ContextFooter />}
    </div>
  );
}
