"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalResourceListResponse,
  ExternalResourceListResponseSchema,
  StudentProfileView,
  StudentProfileViewSchema,
  FeatureFlagsResponse,
  FeatureFlagsResponseSchema,
} from "@upward-english/shared";
import { apiFetch, ApiError } from "../../../lib/api";
import { ErrorState } from "../../../components/error-state";
import {
  KidsExtraLoading,
  KidsExtraMap,
  KidsExtraOffline,
  KidsExtraUnavailable,
} from "./kids-extra";
import type { ResourceFilter } from "./kids-extra";
import {
  TeensExtra,
  TeensExtraLoading,
  TeensExtraOffline,
  TeensExtraUnavailable,
} from "./teens-extra";

export function ExtraClient() {
  // Offline detection (T-05, RF-8)
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== "undefined") return navigator.onLine;
    return true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Queries
  const flagsQuery = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () =>
      apiFetch<FeatureFlagsResponse>("/api/v1/feature-flags", {
        schema: FeatureFlagsResponseSchema,
      }),
  });

  const meQuery = useQuery({
    queryKey: ["student", "profile"],
    queryFn: () =>
      apiFetch<StudentProfileView>("/api/v1/me", {
        schema: StudentProfileViewSchema,
      }),
  });

  const isExtraContentEnabled = Boolean(flagsQuery.data?.flags?.extra_content);

  const resourcesQuery = useQuery({
    queryKey: ["resources"],
    queryFn: () =>
      apiFetch<ExternalResourceListResponse>("/api/v1/resources", {
        schema: ExternalResourceListResponseSchema,
      }),
    enabled: isExtraContentEnabled,
  });

  // Level & Theme detection
  const ageSegment = meQuery.data?.student?.ageSegment ?? "kids";
  const isKids = ageSegment === "kids";
  const studentLevel = meQuery.data?.student?.level ?? null;

  // Local filter pill state
  const [filterPill, setFilterPill] = useState<ResourceFilter>("todos");

  const filteredItems = useMemo(() => {
    const all = resourcesQuery.data?.items ?? [];
    if (filterPill === "generales") {
      return all.filter((item) => item.level === null);
    }
    if (filterPill === "nivel" && studentLevel) {
      return all.filter((item) => item.level === studentLevel);
    }
    return all;
  }, [resourcesQuery.data?.items, filterPill, studentLevel]);

  // Feature flag disabled or 403 response (RF-3, RF-5)
  const isForbiddenError =
    resourcesQuery.error instanceof ApiError &&
    (resourcesQuery.error.code === "EXTRA_CONTENT_DISABLED" ||
      resourcesQuery.error.statusCode === 403);

  const isLoading =
    flagsQuery.isLoading || (isExtraContentEnabled && resourcesQuery.isLoading);
  if (isKids) {
    if (
      !isOnline &&
      (flagsQuery.data === undefined || resourcesQuery.data === undefined)
    ) {
      return <KidsExtraOffline />;
    }
    if (isLoading) return <KidsExtraLoading />;
    if (flagsQuery.isError && flagsQuery.data === undefined) {
      return (
        <ErrorState
          message="No pudimos cargar el mapa."
          onRetry={() => void flagsQuery.refetch()}
        />
      );
    }
    if (!isExtraContentEnabled || isForbiddenError)
      return <KidsExtraUnavailable />;
    if (resourcesQuery.isError && resourcesQuery.data === undefined) {
      return (
        <ErrorState
          message="No pudimos cargar los recursos."
          onRetry={() => void resourcesQuery.refetch()}
        />
      );
    }

    return (
      <KidsExtraMap
        items={filteredItems}
        studentLevel={studentLevel}
        filter={filterPill}
        onFilterChange={setFilterPill}
        isOnline={isOnline}
      />
    );
  }

  if ((flagsQuery.data && !isExtraContentEnabled) || isForbiddenError)
    return <TeensExtraUnavailable />;
  if (!isOnline && (flagsQuery.data === undefined || resourcesQuery.data === undefined)) {
    return <TeensExtraOffline />;
  }
  if (isLoading) return <TeensExtraLoading />;
  if (flagsQuery.isError && flagsQuery.data === undefined) {
    return (
      <ErrorState
        variant="teens"
        message="No pudimos cargar el contenido extra."
        onRetry={() => void flagsQuery.refetch()}
      />
    );
  }
  if (resourcesQuery.isError && resourcesQuery.data === undefined) {
    return (
      <ErrorState
        variant="teens"
        message="No pudimos cargar los recursos."
        onRetry={() => void resourcesQuery.refetch()}
      />
    );
  }

  return (
    <TeensExtra
      items={filteredItems}
      studentLevel={studentLevel}
      filter={filterPill}
      onFilterChange={setFilterPill}
      isOnline={isOnline}
    />
  );
}
