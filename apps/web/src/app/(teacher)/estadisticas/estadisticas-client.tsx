'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  StatsOverviewResponse,
  GroupStatsResponse,
  LeaderboardResponse,
  GamesLeaderboardResponse,
  GroupListResponse,
  GroupView,
  TrendComparisonMode,
  ScoreTrendDirection,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { POLLING_INTERVAL_MS } from '../../../lib/query-client';

type TabType = 'overview' | 'groups' | 'leaderboard' | 'games-leaderboard';
type PeriodPreset = '7d' | '30d' | '90d' | 'custom';

function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '—';
  return score.toFixed(1).replace('.', ',');
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 min';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

function TrendBadge({
  direction,
  delta,
}: {
  direction: ScoreTrendDirection;
  delta: number | null;
}) {
  if (direction === 'none' || delta === null) {
    return <span className="text-zinc-400 text-xs font-medium">—</span>;
  }
  if (direction === 'up') {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs font-semibold">
        ↑ +{delta.toFixed(1)}
      </span>
    );
  }
  if (direction === 'down') {
    return (
      <span className="inline-flex items-center gap-0.5 text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-xs font-semibold">
        ↓ {delta.toFixed(1)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded text-xs font-medium">
      → {delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
    </span>
  );
}

export function EstadisticasClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = (searchParams.get('tab') as TabType) || 'overview';
  const [activeTab, setActiveTab] = useState<TabType>(tabParam);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Period controls
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Groups list for dropdown
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Group tab options
  const [trendMode, setTrendMode] = useState<TrendComparisonMode>('30d');
  const [groupSortBy, setGroupSortBy] = useState<string>('studentName');
  const [groupSortOrder, setGroupSortOrder] = useState<'asc' | 'desc'>('asc');

  // Leaderboard filters
  const [leaderboardLevel, setLeaderboardLevel] = useState<string>('');
  const [leaderboardGroupId, setLeaderboardGroupId] = useState<string>('');

  // Compute current from/to based on preset
  const getDateRange = useCallback((): { from?: string; to?: string } => {
    if (periodPreset === 'custom') {
      return {
        from: customFrom ? new Date(customFrom).toISOString() : undefined,
        to: customTo ? new Date(customTo).toISOString() : undefined,
      };
    }
    const to = new Date();
    let days = 30;
    if (periodPreset === '7d') days = 7;
    if (periodPreset === '90d') days = 90;
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [periodPreset, customFrom, customTo]);

  // Load active groups for dropdowns
  const groupsQuery = useQuery({
    queryKey: ['groups', 'active'],
    queryFn: () => apiFetch<GroupListResponse>('/api/v1/groups?archived=false&limit=100'),
  });
  const groups: GroupView[] = groupsQuery.data?.items ?? [];
  const effectiveGroupId = selectedGroupId || groups[0]?.id || '';

  // Sync tab with URL
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    router.replace(`/estadisticas?${params.toString()}`);
  };

  const buildParams = (): URLSearchParams => {
    const { from, to } = getDateRange();
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params;
  };
  const periodKey = [periodPreset, customFrom, customTo];

  const overviewQuery = useQuery({
    queryKey: ['stats', 'overview', ...periodKey],
    queryFn: () =>
      apiFetch<StatsOverviewResponse>(`/api/v1/stats/overview?${buildParams().toString()}`),
    enabled: activeTab === 'overview',
    refetchInterval: POLLING_INTERVAL_MS,
  });

  const groupQuery = useQuery({
    queryKey: ['stats', 'group', effectiveGroupId, trendMode, groupSortBy, groupSortOrder, ...periodKey],
    queryFn: () => {
      const params = buildParams();
      params.set('trendMode', trendMode);
      params.set('sortBy', groupSortBy);
      params.set('sortOrder', groupSortOrder);
      return apiFetch<GroupStatsResponse>(
        `/api/v1/stats/groups/${effectiveGroupId}?${params.toString()}`,
      );
    },
    enabled: activeTab === 'groups' && effectiveGroupId !== '',
    refetchInterval: POLLING_INTERVAL_MS,
  });

  const leaderboardQuery = useQuery({
    queryKey: ['stats', 'leaderboard', leaderboardLevel, leaderboardGroupId, ...periodKey],
    queryFn: () => {
      const params = buildParams();
      if (leaderboardLevel) params.set('level', leaderboardLevel);
      if (leaderboardGroupId) params.set('groupId', leaderboardGroupId);
      return apiFetch<LeaderboardResponse>(`/api/v1/stats/leaderboard?${params.toString()}`);
    },
    enabled: activeTab === 'leaderboard',
    refetchInterval: POLLING_INTERVAL_MS,
  });

  const gamesLeaderboardQuery = useQuery({
    queryKey: ['stats', 'games-leaderboard', leaderboardLevel, leaderboardGroupId, ...periodKey],
    queryFn: () => {
      const params = buildParams();
      if (leaderboardLevel) params.set('level', leaderboardLevel);
      if (leaderboardGroupId) params.set('groupId', leaderboardGroupId);
      return apiFetch<GamesLeaderboardResponse>(`/api/v1/stats/games-leaderboard?${params.toString()}`);
    },
    enabled: activeTab === 'games-leaderboard',
    refetchInterval: POLLING_INTERVAL_MS,
  });

  const activeQuery =
    activeTab === 'overview'
      ? overviewQuery
      : activeTab === 'groups'
      ? groupQuery
      : activeTab === 'leaderboard'
      ? leaderboardQuery
      : gamesLeaderboardQuery;

  const overviewData = overviewQuery.data ?? null;
  const groupData = groupQuery.data ?? null;
  const leaderboardData = leaderboardQuery.data ?? null;
  const gamesLeaderboardData = gamesLeaderboardQuery.data ?? null;

  const isLoading = activeQuery.isPending && activeQuery.fetchStatus !== 'idle';
  const errorMessage = activeQuery.error
    ? activeQuery.error instanceof ApiError
      ? activeQuery.error.message
      : 'Error al cargar la información estadística'
    : null;
  const lastRefreshedAt = new Date(activeQuery.dataUpdatedAt || Date.now());
  const fetchData = (_showLoadingSpinner?: boolean) => {
    void activeQuery.refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Polling Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Estadísticas y Desempeño
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Métricas de rendimiento escolar y constancia de estudio en tiempo real
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Actualizado {isMounted ? lastRefreshedAt.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'} (cada 30 s)
          </span>
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={isLoading}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 transition-colors"
          >
            Refrescar
          </button>
        </div>
      </div>

      {/* Period Filter Bar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
            Periodo:
          </span>
          <div className="flex items-center rounded-lg bg-zinc-100 p-0.5 text-xs font-medium">
            {(['7d', '30d', '90d', 'custom'] as PeriodPreset[]).map((preset) => {
              const labels: Record<PeriodPreset, string> = {
                '7d': 'Últimos 7 días',
                '30d': 'Últimos 30 días',
                '90d': 'Últimos 90 días',
                custom: 'Personalizado',
              };
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPeriodPreset(preset)}
                  className={`rounded-md px-3 py-1.5 transition-colors ${
                    periodPreset === preset
                      ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {labels[preset]}
                </button>
              );
            })}
          </div>
        </div>

        {periodPreset === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="stats-overview-from" className="text-zinc-600 font-medium">Desde:</label>
            <input
              id="stats-overview-from"
              name="stats-overview-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-800"
            />
            <label htmlFor="stats-overview-to" className="text-zinc-600 font-medium">Hasta:</label>
            <input
              id="stats-overview-to"
              name="stats-overview-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-800"
            />
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-zinc-200">
        <nav className="flex space-x-8" aria-label="Pestañas de estadísticas">
          <button
            type="button"
            onClick={() => handleTabChange('overview')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            Vista General
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('groups')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'groups'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            Por Grupo
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('leaderboard')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'leaderboard'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            Leaderboard de Notas
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('games-leaderboard')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'games-leaderboard'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            Ranking de Juegos
          </button>
        </nav>
      </div>

      {/* Error Banner with Retry */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => fetchData(true)}
            className="rounded-lg bg-rose-600 text-white px-3 py-1 text-xs font-semibold hover:bg-rose-700 transition-colors"
          >
            Reintentar ahora
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-zinc-200 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-zinc-200 rounded-xl" />
        </div>
      )}

      {/* Tab 1: Overview */}
      {!isLoading && activeTab === 'overview' && overviewData && (
        <div className="space-y-8">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-medium text-zinc-500">Alumnos aprobados</span>
              <p className="text-2xl font-bold text-zinc-900 mt-1">
                {overviewData.organizationSummary.totalApprovedStudents}
              </p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-medium text-zinc-500">Activos en periodo</span>
              <p className="text-2xl font-bold text-zinc-900 mt-1">
                {overviewData.organizationSummary.activeStudentsInPeriod}
              </p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-medium text-zinc-500">Nota promedio general</span>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {formatScore(overviewData.organizationSummary.averageScore)}
              </p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-medium text-zinc-500">% Cumplimiento</span>
              <p className="text-2xl font-bold text-zinc-900 mt-1">
                {overviewData.organizationSummary.completionRatePercent !== null
                  ? `${overviewData.organizationSummary.completionRatePercent}%`
                  : '—'}
              </p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-medium text-zinc-500">Tiempo total de estudio</span>
              <p className="text-2xl font-bold text-zinc-900 mt-1">
                {formatDuration(overviewData.organizationSummary.totalTimeSpentSeconds)}
              </p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-medium text-zinc-500">Alumnos en riesgo</span>
              <p className="text-2xl font-bold text-rose-600 mt-1">
                {overviewData.organizationSummary.inactiveAlertsCount}
              </p>
            </div>
          </div>

          {/* Inactive Student Alerts */}
          {overviewData.inactiveAlerts.length > 0 && (
            <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-rose-600 font-bold text-base">⚠️</span>
                <h3 className="text-sm font-bold text-rose-950">
                  Alumnos en riesgo de deserción o abandono (≥ 14 días inactivos)
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {overviewData.inactiveAlerts.map((st) => (
                  <div
                    key={st.studentId}
                    className="bg-white border border-rose-200 rounded-lg p-3 flex flex-col justify-between"
                  >
                    <div>
                      <Link
                        href={`/estadisticas/estudiantes/${st.studentId}`}
                        className="text-sm font-semibold text-zinc-900 hover:text-blue-600 hover:underline"
                      >
                        {st.studentName}
                      </Link>
                      <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                        <span>{st.groupName || 'Sin grupo'}</span>
                        <span>•</span>
                        <span>Nivel {st.level}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Días sin actividad:</span>
                      <span className="font-bold text-rose-600">
                        {st.daysSinceLastActivity !== null ? `${st.daysSinceLastActivity} días` : 'Nunca'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Breakdown by Level */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200">
              <h3 className="text-sm font-bold text-zinc-900">
                Desglose por Nivel MCER (A1, A2, B1, B2)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-800">
                <thead className="bg-zinc-50 text-zinc-700 font-semibold border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-2.5">Nivel</th>
                    <th className="px-4 py-2.5">Total alumnos</th>
                    <th className="px-4 py-2.5">Activos</th>
                    <th className="px-4 py-2.5">Nota promedio</th>
                    <th className="px-4 py-2.5">Asignadas</th>
                    <th className="px-4 py-2.5">Completadas</th>
                    <th className="px-4 py-2.5">% Cumplimiento</th>
                    <th className="px-4 py-2.5">Tiempo dedicado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {overviewData.byLevel.map((lvl) => (
                    <tr key={lvl.level} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-bold text-zinc-900">Nivel {lvl.level}</td>
                      <td className="px-4 py-3">{lvl.studentCount}</td>
                      <td className="px-4 py-3">{lvl.activeStudentCount}</td>
                      <td className="px-4 py-3 font-semibold text-blue-600">
                        {formatScore(lvl.averageScore)}
                      </td>
                      <td className="px-4 py-3">{lvl.assignedCount}</td>
                      <td className="px-4 py-3">{lvl.completedAssignedCount}</td>
                      <td className="px-4 py-3">
                        {lvl.completionRatePercent !== null
                          ? `${lvl.completionRatePercent}%`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {formatDuration(lvl.timeSpentSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Breakdown by Group */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200">
              <h3 className="text-sm font-bold text-zinc-900">
                Comparativa entre Grupos Activos
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-800">
                <thead className="bg-zinc-50 text-zinc-700 font-semibold border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-2.5">Grupo</th>
                    <th className="px-4 py-2.5">Alumnos</th>
                    <th className="px-4 py-2.5">Activos</th>
                    <th className="px-4 py-2.5">Nota promedio</th>
                    <th className="px-4 py-2.5">Asignadas</th>
                    <th className="px-4 py-2.5">Completadas</th>
                    <th className="px-4 py-2.5">% Cumplimiento</th>
                    <th className="px-4 py-2.5">Tiempo dedicado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {overviewData.byGroup.map((grp) => (
                    <tr key={grp.groupId} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedGroupId(grp.groupId);
                            handleTabChange('groups');
                          }}
                          className="text-blue-600 hover:underline text-left font-semibold"
                        >
                          {grp.groupName}
                        </button>
                      </td>
                      <td className="px-4 py-3">{grp.studentCount}</td>
                      <td className="px-4 py-3">{grp.activeStudentCount}</td>
                      <td className="px-4 py-3 font-semibold text-blue-600">
                        {formatScore(grp.averageScore)}
                      </td>
                      <td className="px-4 py-3">{grp.assignedCount}</td>
                      <td className="px-4 py-3">{grp.completedAssignedCount}</td>
                      <td className="px-4 py-3">
                        {grp.completionRatePercent !== null
                          ? `${grp.completionRatePercent}%`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {formatDuration(grp.timeSpentSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Groups */}
      {!isLoading && activeTab === 'groups' && (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <label htmlFor="stats-group-select" className="text-xs font-semibold text-zinc-700">
                Seleccionar grupo:
              </label>
              <select
                id="stats-group-select"
                name="groupId"
                aria-label="Seleccionar grupo"
                value={effectiveGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-800 bg-white"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Trend Mode Toggle: 30d vs 7d */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-600">Tendencia comparada:</span>
              <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setTrendMode('30d')}
                  className={`rounded-md px-3 py-1 transition-colors ${
                    trendMode === '30d'
                      ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Cada 30 días
                </button>
                <button
                  type="button"
                  onClick={() => setTrendMode('7d')}
                  className={`rounded-md px-3 py-1 transition-colors ${
                    trendMode === '7d'
                      ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Semanal (7 días)
                </button>
              </div>
            </div>
          </div>

          {/* Group Summary Banner */}
          {groupData && (
            <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <span className="text-xs text-blue-900 font-medium">Grupo</span>
                <p className="text-base font-bold text-zinc-900">{groupData.group.name}</p>
              </div>
              <div>
                <span className="text-xs text-blue-900 font-medium">Total alumnos</span>
                <p className="text-base font-bold text-zinc-900">{groupData.summary.studentCount}</p>
              </div>
              <div>
                <span className="text-xs text-blue-900 font-medium">Promedio grupo</span>
                <p className="text-base font-bold text-blue-700">
                  {formatScore(groupData.summary.averageScore)}
                </p>
              </div>
              <div>
                <span className="text-xs text-blue-900 font-medium">Actividades completadas</span>
                <p className="text-base font-bold text-zinc-900">
                  {groupData.summary.completedAssignedCount} / {groupData.summary.assignedCount}
                </p>
              </div>
              <div>
                <span className="text-xs text-blue-900 font-medium">% Cumplimiento</span>
                <p className="text-base font-bold text-zinc-900">
                  {groupData.summary.completionRatePercent !== null
                    ? `${groupData.summary.completionRatePercent}%`
                    : '—'}
                </p>
              </div>
              <div>
                <span className="text-xs text-blue-900 font-medium">Tiempo total</span>
                <p className="text-base font-bold text-zinc-900">
                  {formatDuration(groupData.summary.timeSpentSeconds)}
                </p>
              </div>
            </div>
          )}

          {/* Práctica en Juegos para el Grupo (Decision 137, ENG-162) */}
          {groupData && groupData.gamesPractice && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl" aria-hidden="true">🎮</span>
                  <h3 className="text-sm font-bold text-amber-950">Práctica en Juegos del Grupo</h3>
                </div>
                <span className="text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                  Práctica autónoma (excluida de notas académicas)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-3 rounded-lg border border-amber-200">
                  <span className="text-xs text-zinc-500 font-medium">Partidas jugadas en el grupo</span>
                  <p className="text-lg font-bold text-zinc-900">{groupData.gamesPractice.totalSessions}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-amber-200">
                  <span className="text-xs text-zinc-500 font-medium">Juegos distintos explorados</span>
                  <p className="text-lg font-bold text-zinc-900">{groupData.gamesPractice.uniqueGamesPlayed}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-amber-200">
                  <span className="text-xs text-zinc-500 font-medium">Tiempo total de práctica</span>
                  <p className="text-lg font-bold text-zinc-900">{formatDuration(groupData.gamesPractice.totalPracticeTimeSeconds)}</p>
                </div>
              </div>

              {groupData.gamesPractice.byMechanic && groupData.gamesPractice.byMechanic.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    Desglose por Mecánica de Juego
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-800">
                      <thead className="bg-amber-100/60 text-amber-950 font-semibold border-b border-amber-200">
                        <tr>
                          <th className="px-3 py-2">Mecánica</th>
                          <th className="px-3 py-2">Partidas</th>
                          <th className="px-3 py-2">Juegos distintos</th>
                          <th className="px-3 py-2">Tiempo practicado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-200/50 bg-white">
                        {groupData.gamesPractice.byMechanic.map((m) => (
                          <tr key={m.mechanic}>
                            <td className="px-3 py-2 font-medium capitalize text-zinc-900">
                              {m.mechanic.replace('_', ' ')}
                            </td>
                            <td className="px-3 py-2 text-zinc-700">{m.sessionsCount}</td>
                            <td className="px-3 py-2 text-zinc-700">{m.uniqueGamesCount}</td>
                            <td className="px-3 py-2 text-zinc-700">{formatDuration(m.practiceTimeSeconds)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Students Table with 30d and 7d trend columns */}
          {groupData && (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-800">
                  <thead className="bg-zinc-50 text-zinc-700 font-semibold border-b border-zinc-200">
                    <tr>
                      <th
                        className="px-4 py-3 cursor-pointer hover:bg-zinc-100"
                        onClick={() => {
                          setGroupSortBy('studentName');
                          setGroupSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        }}
                      >
                        Alumno {groupSortBy === 'studentName' && (groupSortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-3 py-3">Nivel</th>
                      <th className="px-3 py-3">Segmento</th>
                      <th
                        className="px-4 py-3 cursor-pointer hover:bg-zinc-100"
                        onClick={() => {
                          setGroupSortBy('averageScore');
                          setGroupSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        }}
                      >
                        Promedio {groupSortBy === 'averageScore' && (groupSortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-4 py-3">
                        {trendMode === '7d' ? 'Tendencia 7d' : 'Tendencia 30d'}
                      </th>
                      <th
                        className="px-3 py-3 cursor-pointer hover:bg-zinc-100"
                        onClick={() => {
                          setGroupSortBy('activeWeeksInPeriod');
                          setGroupSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        }}
                      >
                        Semanas activas
                      </th>
                      <th
                        className="px-3 py-3 cursor-pointer hover:bg-zinc-100"
                        onClick={() => {
                          setGroupSortBy('currentStreakWeeks');
                          setGroupSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        }}
                      >
                        Racha vigente
                      </th>
                      <th
                        className="px-4 py-3 cursor-pointer hover:bg-zinc-100"
                        onClick={() => {
                          setGroupSortBy('completionRatePercent');
                          setGroupSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        }}
                      >
                        Cumplimiento
                      </th>
                      <th
                        className="px-4 py-3 cursor-pointer hover:bg-zinc-100"
                        onClick={() => {
                          setGroupSortBy('timeSpentSeconds');
                          setGroupSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        }}
                      >
                        Tiempo
                      </th>
                      <th className="px-3 py-3">Última actividad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {groupData.students.map((st) => (
                      <tr key={st.studentId} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          <Link
                            href={`/estadisticas/estudiantes/${st.studentId}`}
                            className="text-blue-600 hover:underline font-semibold"
                          >
                            {st.studentName}
                          </Link>
                          {!st.isCurrentMember && (
                            <span className="ml-2 text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                              Ex-miembro
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">{st.level}</td>
                        <td className="px-3 py-3 capitalize">{st.ageSegment}</td>
                        <td className="px-4 py-3 font-bold text-blue-600">
                          {formatScore(st.averageScore)}
                        </td>
                        <td className="px-4 py-3">
                          <TrendBadge
                            direction={st.scoreTrend}
                            delta={st.scoreTrendDelta}
                          />
                        </td>
                        <td className="px-3 py-3">{st.activeWeeksInPeriod}</td>
                        <td className="px-3 py-3">
                          <span className="font-semibold text-zinc-900">
                            {st.currentStreakWeeks} sem
                          </span>
                          {st.forgivenessAvailable && (
                            <span className="ml-1 text-[10px] text-emerald-700 bg-emerald-50 px-1 rounded font-medium">
                              Perdón disp.
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {st.completionRatePercent !== null ? (
                            <span>
                              {st.completionRatePercent}% ({st.completedAssignedCount}/{st.assignedCount})
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {formatDuration(st.timeSpentSeconds)}
                        </td>
                        <td className="px-3 py-3 text-zinc-500">
                          {st.lastActivityAt
                            ? new Date(st.lastActivityAt).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Leaderboard (Academic) */}
      {!isLoading && activeTab === 'leaderboard' && (
        <div className="space-y-6">
          {/* Privacy Disclaimer (RF-8) */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
            <span className="text-base">🔒</span>
            <div>
              <p className="font-semibold">Aviso de confidencialidad docente</p>
              <p className="mt-0.5 text-amber-800">
                Este leaderboard es exclusivo para el equipo docente. Los estudiantes no tienen acceso a rankings, puestos ni comparativas entre compañeros en el portal del alumno.
              </p>
            </div>
          </div>

          {/* Filters Bar: Level Groups and Specific Group (Decisión 115) */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-zinc-700">Filtrar por Nivel:</span>
              <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 text-xs font-medium">
                {['', 'A1', 'A2', 'B1', 'B2'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLeaderboardLevel(lvl)}
                    className={`rounded-md px-3 py-1 transition-colors ${
                      leaderboardLevel === lvl
                        ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    {lvl === '' ? 'Todos' : lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="leaderboard-group-select" className="text-xs font-semibold text-zinc-700">
                Grupo:
              </label>
              <select
                id="leaderboard-group-select"
                name="leaderboardGroupId"
                aria-label="Filtrar por grupo"
                value={leaderboardGroupId}
                onChange={(e) => setLeaderboardGroupId(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-800 bg-white"
              >
                <option value="">Todos los grupos</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Leaderboard Table */}
          {leaderboardData && (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-800">
                  <thead className="bg-zinc-50 text-zinc-700 font-semibold border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-3 w-16 text-center">Puesto</th>
                      <th className="px-4 py-3">Alumno</th>
                      <th className="px-3 py-3">Nivel</th>
                      <th className="px-3 py-3">Segmento</th>
                      <th className="px-4 py-3">Grupo</th>
                      <th className="px-4 py-3">Nota promedio</th>
                      <th className="px-4 py-3">Actividades completadas</th>
                      <th className="px-4 py-3">Racha actual</th>
                      <th className="px-4 py-3">Insignias</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {leaderboardData.entries.map((entry) => (
                      <tr
                        key={entry.studentId}
                        className={`hover:bg-zinc-50 ${
                          entry.rank <= 3 ? 'bg-amber-50/20 font-medium' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-center font-bold">
                          {entry.rank === 1 ? '🥇 1' : entry.rank === 2 ? '🥈 2' : entry.rank === 3 ? '🥉 3' : `#${entry.rank}`}
                        </td>
                        <td className="px-4 py-3 font-semibold text-zinc-900">
                          <Link
                            href={`/estadisticas/estudiantes/${entry.studentId}`}
                            className="text-blue-600 hover:underline"
                          >
                            {entry.studentName}
                          </Link>
                        </td>
                        <td className="px-3 py-3">{entry.level}</td>
                        <td className="px-3 py-3 capitalize">{entry.ageSegment}</td>
                        <td className="px-4 py-3 text-zinc-600">{entry.groupName || 'Sin grupo'}</td>
                        <td className="px-4 py-3 font-bold text-blue-600">
                          {formatScore(entry.averageScore)}
                        </td>
                        <td className="px-4 py-3">{entry.completedActivitiesCount}</td>
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          {entry.currentStreakWeeks} sem
                        </td>
                        <td className="px-4 py-3 font-medium text-amber-700">
                          ⭐ {entry.badgesCount}
                        </td>
                      </tr>
                    ))}
                    {leaderboardData.entries.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                          No hay alumnos registrados que cumplan los criterios seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Games Leaderboard (Autonomous practice, Decision 137) */}
      {!isLoading && activeTab === 'games-leaderboard' && (
        <div className="space-y-6">
          {/* Privacy Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
            <span className="text-base">🔒</span>
            <div>
              <p className="font-semibold">Aviso de confidencialidad docente — Ranking de Juegos</p>
              <p className="mt-0.5 text-amber-800">
                Este ranking registra la práctica autónoma de microjuegos y es exclusivo del equipo docente.
                Los microjuegos están excluidos del promedio de notas escolar.
              </p>
            </div>
          </div>

          {/* Filters Bar: Level and Group */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-zinc-700">Filtrar por Nivel:</span>
              <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 text-xs font-medium">
                {['', 'A1', 'A2', 'B1', 'B2'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLeaderboardLevel(lvl)}
                    className={`rounded-md px-3 py-1 transition-colors ${
                      leaderboardLevel === lvl
                        ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    {lvl === '' ? 'Todos' : lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="games-leaderboard-group-select" className="text-xs font-semibold text-zinc-700">
                Grupo:
              </label>
              <select
                id="games-leaderboard-group-select"
                name="gamesLeaderboardGroupId"
                aria-label="Filtrar por grupo en ranking de juegos"
                value={leaderboardGroupId}
                onChange={(e) => setLeaderboardGroupId(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-800 bg-white"
              >
                <option value="">Todos los grupos</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Games Leaderboard Table */}
          {gamesLeaderboardData && (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-800">
                  <thead className="bg-zinc-50 text-zinc-700 font-semibold border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-3 w-16 text-center">Puesto</th>
                      <th className="px-4 py-3">Alumno</th>
                      <th className="px-3 py-3">Nivel</th>
                      <th className="px-4 py-3">Grupo</th>
                      <th className="px-4 py-3 text-right">Puntos de juego</th>
                      <th className="px-4 py-3 text-center">Estrellas</th>
                      <th className="px-4 py-3 text-center">Partidas</th>
                      <th className="px-4 py-3 text-center">Juegos distintos</th>
                      <th className="px-4 py-3">Tiempo de práctica</th>
                      <th className="px-4 py-3">Última partida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {gamesLeaderboardData.items.map((item) => (
                      <tr
                        key={item.studentId}
                        className={`hover:bg-zinc-50 ${
                          item.rank <= 3 ? 'bg-amber-50/20 font-medium' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-center font-bold">
                          {item.rank === 1 ? '🥇 1' : item.rank === 2 ? '🥈 2' : item.rank === 3 ? '🥉 3' : `#${item.rank}`}
                        </td>
                        <td className="px-4 py-3 font-semibold text-zinc-900">
                          <Link
                            href={`/estadisticas/estudiantes/${item.studentId}`}
                            className="text-blue-600 hover:underline"
                          >
                            {item.studentName}
                          </Link>
                        </td>
                        <td className="px-3 py-3">{item.level}</td>
                        <td className="px-4 py-3 text-zinc-600">{item.groupName || 'Sin grupo'}</td>
                        <td className="px-4 py-3 text-right font-bold text-amber-700">
                          {item.gamePoints} pts
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-amber-600">
                          ⭐ {item.totalStars}
                        </td>
                        <td className="px-4 py-3 text-center">{item.gamesPlayedCount}</td>
                        <td className="px-4 py-3 text-center">{item.uniqueGamesPlayed}</td>
                        <td className="px-4 py-3 text-zinc-600">
                          {formatDuration(item.practiceTimeSeconds)}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {item.lastPlayedAt
                            ? new Date(item.lastPlayedAt).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                    {gamesLeaderboardData.items.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-zinc-500">
                          Sin partidas de microjuegos registradas en el periodo seleccionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
