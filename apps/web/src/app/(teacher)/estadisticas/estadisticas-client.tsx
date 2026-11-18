'use client';

import styles from '../origami-management.module.css';

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  StatsOverviewResponse,
  StatsOverviewResponseSchema,
  GroupStatsResponse,
  GroupStatsResponseSchema,
  LeaderboardResponse,
  LeaderboardResponseSchema,
  GamesLeaderboardResponse,
  GamesLeaderboardResponseSchema,
  GroupListResponse,
  GroupListResponseSchema,
  GroupView,
  TrendComparisonMode,
  ScoreTrendDirection,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { POLLING_INTERVAL_MS } from '../../../lib/query-client';

type TabType = 'overview' | 'groups' | 'leaderboard' | 'games-leaderboard';
type PeriodPreset = '7d' | '30d' | '90d' | 'custom';
const PERIOD_PRESETS: readonly PeriodPreset[] = ['7d', '30d', '90d', 'custom'];

function isTabType(val: string | null): val is TabType {
  return (
    val === 'overview' ||
    val === 'groups' ||
    val === 'leaderboard' ||
    val === 'games-leaderboard'
  );
}

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
    return (
      <span className="text-[var(--origami-text-secondary)] text-xs font-medium">
        —
      </span>
    );
  }
  if (direction === 'up') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[var(--origami-success-text)] bg-[var(--origami-success-bg)] px-2 py-0.5 rounded text-xs font-semibold">
        <span aria-hidden="true">↑</span> Subió +
        {delta.toFixed(1).replace('.', ',')}
      </span>
    );
  }
  if (direction === 'down') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[var(--origami-error-text)] bg-[var(--origami-error-bg)] px-2 py-0.5 rounded text-xs font-semibold">
        <span aria-hidden="true">↓</span> Bajó{' '}
        {delta.toFixed(1).replace('.', ',')}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-0.5 text-[var(--origami-text-secondary)] bg-[var(--origami-surface-raised)] px-2 py-0.5 rounded text-xs font-medium">
      <span aria-hidden="true">→</span> Estable{' '}
      {delta >= 0
        ? `+${delta.toFixed(1).replace('.', ',')}`
        : delta.toFixed(1).replace('.', ',')}
    </span>
  );
}

export function EstadisticasClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get('tab');
  const tabParam: TabType = isTabType(rawTab) ? rawTab : 'overview';
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
    queryKey: ['teacher', 'groups', 'active'],
    queryFn: () =>
      apiFetch<GroupListResponse>('/api/v1/groups?archived=false&limit=100', {
        schema: GroupListResponseSchema,
      }),
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
      apiFetch<StatsOverviewResponse>(
        `/api/v1/stats/overview?${buildParams().toString()}`,
        { schema: StatsOverviewResponseSchema },
      ),
    enabled: activeTab === 'overview',
    refetchInterval: POLLING_INTERVAL_MS,
  });

  const groupQuery = useQuery({
    queryKey: [
      'stats',
      'group',
      effectiveGroupId,
      trendMode,
      groupSortBy,
      groupSortOrder,
      ...periodKey,
    ],
    queryFn: () => {
      const params = buildParams();
      params.set('trendMode', trendMode);
      params.set('sortBy', groupSortBy);
      params.set('sortOrder', groupSortOrder);
      return apiFetch<GroupStatsResponse>(
        `/api/v1/stats/groups/${effectiveGroupId}?${params.toString()}`,
        { schema: GroupStatsResponseSchema },
      );
    },
    enabled: activeTab === 'groups' && effectiveGroupId !== '',
    refetchInterval: POLLING_INTERVAL_MS,
  });

  const leaderboardQuery = useQuery({
    queryKey: [
      'stats',
      'leaderboard',
      leaderboardLevel,
      leaderboardGroupId,
      ...periodKey,
    ],
    queryFn: () => {
      const params = buildParams();
      if (leaderboardLevel) params.set('level', leaderboardLevel);
      if (leaderboardGroupId) params.set('groupId', leaderboardGroupId);
      return apiFetch<LeaderboardResponse>(
        `/api/v1/stats/leaderboard?${params.toString()}`,
        { schema: LeaderboardResponseSchema },
      );
    },
    enabled: activeTab === 'leaderboard',
    refetchInterval: POLLING_INTERVAL_MS,
  });

  const gamesLeaderboardQuery = useQuery({
    queryKey: [
      'stats',
      'games-leaderboard',
      leaderboardLevel,
      leaderboardGroupId,
      ...periodKey,
    ],
    queryFn: () => {
      const params = buildParams();
      if (leaderboardLevel) params.set('level', leaderboardLevel);
      if (leaderboardGroupId) params.set('groupId', leaderboardGroupId);
      return apiFetch<GamesLeaderboardResponse>(
        `/api/v1/stats/games-leaderboard?${params.toString()}`,
        { schema: GamesLeaderboardResponseSchema },
      );
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
    <div className="space-y-6 min-w-0">
      {/* Header with Title and Polling Status */}
      <div className="flex flex-wrap flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--origami-border-subtle)] pb-5">
        <div>
          <h1 className="origami-page-title text-[var(--origami-text-primary)]">
            Estadísticas y Desempeño
          </h1>
          <p className="text-sm text-[var(--origami-text-secondary)] mt-1">
            Métricas de rendimiento escolar y constancia de estudio en tiempo
            real
          </p>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--origami-text-secondary)] bg-[var(--origami-surface-raised)] px-3 py-1 rounded-full">
            <span className="h-2 w-2 rounded-full bg-[var(--origami-success-text)]" />
            Actualizado{' '}
            {isMounted
              ? lastRefreshedAt.toLocaleTimeString('es-CO', {
                  timeZone: 'America/Bogota',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : '—'}{' '}
            (cada 30 s)
          </span>
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={isLoading}
            className="origami-button origami-button--secondary"
          >
            Refrescar
          </button>
        </div>
      </div>

      {/* Period Filter Bar */}
      <div className="origami-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--origami-text-secondary)]">
            Periodo:
          </span>
          <div className="flex flex-wrap items-center gap-2 bg-[var(--origami-surface-raised)] p-0.5 text-xs font-medium">
            {PERIOD_PRESETS.map((preset) => {
              const labels: Record<PeriodPreset, string> = {
                '7d': 'Últimos 7 días',
                '30d': 'Últimos 30 días',
                '90d': 'Últimos 90 días',
                custom: 'Personalizado',
              };
              return (
                <button
                  aria-pressed={periodPreset === preset}
                  key={preset}
                  type="button"
                  onClick={() => setPeriodPreset(preset)}
                  className={
                    'origami-button origami-button--secondary' +
                    (periodPreset === preset ? ' origami-selected' : '')
                  }
                >
                  {labels[preset]}
                </button>
              );
            })}
          </div>
        </div>

        {periodPreset === 'custom' && (
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
            <label
              htmlFor="stats-overview-from"
              className="origami-label font-medium"
            >
              Desde:
            </label>
            <input
              id="stats-overview-from"
              name="stats-overview-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="origami-field"
            />
            <label
              htmlFor="stats-overview-to"
              className="origami-label font-medium"
            >
              Hasta:
            </label>
            <input
              id="stats-overview-to"
              name="stats-overview-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="origami-field"
            />
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-[var(--origami-border-subtle)]">
        <nav
          className="flex flex-wrap gap-2 pb-3"
          aria-label="Pestañas de estadísticas"
        >
          <button
            aria-pressed={activeTab === 'overview'}
            type="button"
            onClick={() => handleTabChange('overview')}
            className={
              'origami-button origami-button--secondary' +
              (activeTab === 'overview' ? ' origami-selected' : '')
            }
          >
            Vista General
          </button>
          <button
            aria-pressed={activeTab === 'groups'}
            type="button"
            onClick={() => handleTabChange('groups')}
            className={
              'origami-button origami-button--secondary' +
              (activeTab === 'groups' ? ' origami-selected' : '')
            }
          >
            Por Grupo
          </button>
          <button
            aria-pressed={activeTab === 'leaderboard'}
            type="button"
            onClick={() => handleTabChange('leaderboard')}
            className={
              'origami-button origami-button--secondary' +
              (activeTab === 'leaderboard' ? ' origami-selected' : '')
            }
          >
            Leaderboard de Notas
          </button>
          <button
            aria-pressed={activeTab === 'games-leaderboard'}
            type="button"
            onClick={() => handleTabChange('games-leaderboard')}
            className={
              'origami-button origami-button--secondary' +
              (activeTab === 'games-leaderboard' ? ' origami-selected' : '')
            }
          >
            Ranking de Juegos
          </button>
        </nav>
      </div>

      {/* Error Banner with Retry */}
      {errorMessage && (
        <div
          role="alert"
          className="origami-state origami-state--error flex flex-wrap items-center justify-between gap-2"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => fetchData(true)}
            className="origami-button"
          >
            Reintentar ahora
          </button>
        </div>
      )}

      {/* Loading status */}
      {isLoading && (
        <p role="status" className="origami-state">
          Cargando estadísticas…
        </p>
      )}

      {/* Tab 1: Overview */}
      {!isLoading && activeTab === 'overview' && overviewData && (
        <div className="space-y-8">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="origami-card">
              <span className="text-xs font-medium text-[var(--origami-text-secondary)]">
                Alumnos aprobados
              </span>
              <p className="origami-tabular text-2xl font-bold text-[var(--origami-text-primary)] mt-1">
                {overviewData.organizationSummary.totalApprovedStudents}
              </p>
            </div>
            <div className="origami-card">
              <span className="text-xs font-medium text-[var(--origami-text-secondary)]">
                Activos en periodo
              </span>
              <p className="origami-tabular text-2xl font-bold text-[var(--origami-text-primary)] mt-1">
                {overviewData.organizationSummary.activeStudentsInPeriod}
              </p>
            </div>
            <div className="origami-card">
              <span className="text-xs font-medium text-[var(--origami-text-secondary)]">
                Nota promedio general
              </span>
              <p className="origami-tabular text-2xl font-bold text-[var(--origami-info-text)] mt-1">
                {formatScore(overviewData.organizationSummary.averageScore)}
              </p>
            </div>
            <div className="origami-card">
              <span className="text-xs font-medium text-[var(--origami-text-secondary)]">
                % Cumplimiento
              </span>
              <p className="origami-tabular text-2xl font-bold text-[var(--origami-text-primary)] mt-1">
                {overviewData.organizationSummary.completionRatePercent !== null
                  ? `${overviewData.organizationSummary.completionRatePercent}%`
                  : '—'}
              </p>
            </div>
            <div className="origami-card">
              <span className="text-xs font-medium text-[var(--origami-text-secondary)]">
                Tiempo total de estudio
              </span>
              <p className="origami-tabular text-2xl font-bold text-[var(--origami-text-primary)] mt-1">
                {formatDuration(
                  overviewData.organizationSummary.totalTimeSpentSeconds,
                )}
              </p>
            </div>
            <div className="origami-card">
              <span className="text-xs font-medium text-[var(--origami-text-secondary)]">
                Alumnos en riesgo
              </span>
              <p className="origami-tabular text-2xl font-bold text-[var(--origami-error-text)] mt-1">
                {overviewData.organizationSummary.inactiveAlertsCount}
              </p>
            </div>
          </div>

          {/* Inactive Student Alerts */}
          {overviewData.inactiveAlerts.length > 0 && (
            <div className="bg-[var(--origami-error-bg)] border border-[var(--origami-border-subtle)] rounded-xl p-5 space-y-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-[var(--origami-error-text)] font-bold text-base">
                  ⚠️
                </span>
                <h3 className="origami-card-title text-[var(--origami-error-text)]">
                  Alumnos en riesgo de deserción o abandono (≥ 14 días
                  inactivos)
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {overviewData.inactiveAlerts.map((st) => (
                  <div
                    key={st.studentId}
                    className="bg-[var(--origami-surface)] border border-[var(--origami-border-subtle)] rounded-lg p-3 flex flex-col justify-between"
                  >
                    <div>
                      <Link
                        href={`/estadisticas/estudiantes/${st.studentId}`}
                        className="text-sm font-semibold text-[var(--origami-text-primary)] hover:text-[var(--origami-info-text)] hover:underline underline underline-offset-4"
                      >
                        {st.studentName}
                      </Link>
                      <div className="flex min-w-0 flex-wrap items-center gap-2 mt-1 text-xs text-[var(--origami-text-secondary)]">
                        <span>{st.groupName || 'Sin grupo'}</span>
                        <span>•</span>
                        <span>Nivel {st.level}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-[var(--origami-border-subtle)] flex items-center justify-between text-xs">
                      <span className="text-[var(--origami-text-secondary)]">
                        Días sin actividad:
                      </span>
                      <span className="font-bold text-[var(--origami-error-text)]">
                        {st.daysSinceLastActivity !== null
                          ? `${st.daysSinceLastActivity} días`
                          : 'Nunca'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Breakdown by Level */}
          <div className="origami-card">
            <div className="px-5 py-4 border-b border-[var(--origami-border-subtle)]">
              <h3 className="origami-card-title text-[var(--origami-text-primary)]">
                Desglose por Nivel MCER (A1, A2, B1, B2)
              </h3>
            </div>
            <div
              role="region"
              tabIndex={0}
              aria-label="Desempeño por nivel"
              className="origami-table-scroll"
            >
              <table
                aria-label="Desempeño por nivel"
                className={styles.comparativeTable}
              >
                <thead className="bg-[var(--origami-surface-soft)] text-[var(--origami-text-secondary)] font-semibold border-b border-[var(--origami-border-subtle)]">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">
                      Nivel
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Total alumnos
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Activos
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Nota promedio
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Asignadas
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Completadas
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      % Cumplimiento
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Tiempo dedicado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--origami-border-subtle)]">
                  {overviewData.byLevel.map((lvl) => (
                    <tr
                      key={lvl.level}
                      className="hover:bg-[var(--origami-surface-soft)]"
                    >
                      <td className="px-4 py-3 font-bold text-[var(--origami-text-primary)]">
                        Nivel {lvl.level}
                      </td>
                      <td className="px-4 py-3">{lvl.studentCount}</td>
                      <td className="px-4 py-3">{lvl.activeStudentCount}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--origami-info-text)]">
                        {formatScore(lvl.averageScore)}
                      </td>
                      <td className="px-4 py-3">{lvl.assignedCount}</td>
                      <td className="px-4 py-3">
                        {lvl.completedAssignedCount}
                      </td>
                      <td className="px-4 py-3">
                        {lvl.completionRatePercent !== null
                          ? `${lvl.completionRatePercent}%`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--origami-text-secondary)]">
                        {formatDuration(lvl.timeSpentSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Breakdown by Group */}
          <div className="origami-card">
            <div className="px-5 py-4 border-b border-[var(--origami-border-subtle)]">
              <h3 className="origami-card-title text-[var(--origami-text-primary)]">
                Comparativa entre Grupos Activos
              </h3>
            </div>
            <div
              role="region"
              tabIndex={0}
              aria-label="Desempeño por grupo"
              className="origami-table-scroll"
            >
              <table
                aria-label="Desempeño por grupo"
                className={styles.comparativeTable}
              >
                <thead className="bg-[var(--origami-surface-soft)] text-[var(--origami-text-secondary)] font-semibold border-b border-[var(--origami-border-subtle)]">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">
                      Grupo
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Alumnos
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Activos
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Nota promedio
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Asignadas
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Completadas
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      % Cumplimiento
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Tiempo dedicado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--origami-border-subtle)]">
                  {overviewData.byGroup.map((grp) => (
                    <tr
                      key={grp.groupId}
                      className="hover:bg-[var(--origami-surface-soft)]"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--origami-text-primary)]">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedGroupId(grp.groupId);
                            handleTabChange('groups');
                          }}
                          className="origami-button origami-button--text"
                        >
                          {grp.groupName}
                        </button>
                      </td>
                      <td className="px-4 py-3">{grp.studentCount}</td>
                      <td className="px-4 py-3">{grp.activeStudentCount}</td>
                      <td className="px-4 py-3 font-semibold text-[var(--origami-info-text)]">
                        {formatScore(grp.averageScore)}
                      </td>
                      <td className="px-4 py-3">{grp.assignedCount}</td>
                      <td className="px-4 py-3">
                        {grp.completedAssignedCount}
                      </td>
                      <td className="px-4 py-3">
                        {grp.completionRatePercent !== null
                          ? `${grp.completionRatePercent}%`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--origami-text-secondary)]">
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
        <div className="space-y-6 min-w-0">
          <div className="origami-card flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <label htmlFor="stats-group-select" className="origami-label">
                Seleccionar grupo:
              </label>
              <select
                id="stats-group-select"
                name="groupId"
                aria-label="Seleccionar grupo"
                value={effectiveGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="origami-field"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Trend Mode Toggle: 30d vs 7d */}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[var(--origami-text-secondary)]">
                Tendencia comparada:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  aria-pressed={trendMode === '30d'}
                  type="button"
                  onClick={() => setTrendMode('30d')}
                  className={
                    'origami-button origami-button--secondary' +
                    (trendMode === '30d' ? ' origami-selected' : '')
                  }
                >
                  Cada 30 días
                </button>
                <button
                  aria-pressed={trendMode === '7d'}
                  type="button"
                  onClick={() => setTrendMode('7d')}
                  className={
                    'origami-button origami-button--secondary' +
                    (trendMode === '7d' ? ' origami-selected' : '')
                  }
                >
                  Semanal (7 días)
                </button>
              </div>
            </div>
          </div>

          {/* Group Summary Banner */}
          {groupData && (
            <div className="bg-[var(--origami-info-bg)] border border-[var(--origami-border-subtle)] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <span className="text-xs text-[var(--origami-info-text)] font-medium">
                  Grupo
                </span>
                <p className="text-base font-bold text-[var(--origami-text-primary)]">
                  {groupData.group.name}
                </p>
              </div>
              <div>
                <span className="text-xs text-[var(--origami-info-text)] font-medium">
                  Total alumnos
                </span>
                <p className="text-base font-bold text-[var(--origami-text-primary)]">
                  {groupData.summary.studentCount}
                </p>
              </div>
              <div>
                <span className="text-xs text-[var(--origami-info-text)] font-medium">
                  Promedio grupo
                </span>
                <p className="text-base font-bold text-[var(--origami-info-text)]">
                  {formatScore(groupData.summary.averageScore)}
                </p>
              </div>
              <div>
                <span className="text-xs text-[var(--origami-info-text)] font-medium">
                  Actividades completadas
                </span>
                <p className="text-base font-bold text-[var(--origami-text-primary)]">
                  {groupData.summary.completedAssignedCount} /{' '}
                  {groupData.summary.assignedCount}
                </p>
              </div>
              <div>
                <span className="text-xs text-[var(--origami-info-text)] font-medium">
                  % Cumplimiento
                </span>
                <p className="text-base font-bold text-[var(--origami-text-primary)]">
                  {groupData.summary.completionRatePercent !== null
                    ? `${groupData.summary.completionRatePercent}%`
                    : '—'}
                </p>
              </div>
              <div>
                <span className="text-xs text-[var(--origami-info-text)] font-medium">
                  Tiempo total
                </span>
                <p className="text-base font-bold text-[var(--origami-text-primary)]">
                  {formatDuration(groupData.summary.timeSpentSeconds)}
                </p>
              </div>
            </div>
          )}

          {/* Práctica en Juegos para el Grupo (Decision 137, ENG-162) */}
          {groupData && groupData.gamesPractice && (
            <div className="bg-[var(--origami-warning-bg)] border border-[var(--origami-border-subtle)] rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-xl" aria-hidden="true">
                    🎮
                  </span>
                  <h3 className="origami-card-title text-[var(--origami-warning-text)]">
                    Práctica en Juegos del Grupo
                  </h3>
                </div>
                <span className="text-xs font-semibold text-[var(--origami-warning-text)] bg-[var(--origami-warning-bg)] border border-[var(--origami-border-control)] px-2.5 py-0.5 rounded-full">
                  Práctica autónoma (excluida de notas académicas)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[var(--origami-surface)] p-3 rounded-lg border border-[var(--origami-border-subtle)]">
                  <span className="text-xs text-[var(--origami-text-secondary)] font-medium">
                    Partidas jugadas en el grupo
                  </span>
                  <p className="text-lg font-bold text-[var(--origami-text-primary)]">
                    {groupData.gamesPractice.totalSessions}
                  </p>
                </div>
                <div className="bg-[var(--origami-surface)] p-3 rounded-lg border border-[var(--origami-border-subtle)]">
                  <span className="text-xs text-[var(--origami-text-secondary)] font-medium">
                    Juegos distintos explorados
                  </span>
                  <p className="text-lg font-bold text-[var(--origami-text-primary)]">
                    {groupData.gamesPractice.uniqueGamesPlayed}
                  </p>
                </div>
                <div className="bg-[var(--origami-surface)] p-3 rounded-lg border border-[var(--origami-border-subtle)]">
                  <span className="text-xs text-[var(--origami-text-secondary)] font-medium">
                    Tiempo total de práctica
                  </span>
                  <p className="text-lg font-bold text-[var(--origami-text-primary)]">
                    {formatDuration(
                      groupData.gamesPractice.totalPracticeTimeSeconds,
                    )}
                  </p>
                </div>
              </div>

              {groupData.gamesPractice.byMechanic &&
                groupData.gamesPractice.byMechanic.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h4 className="origami-card-title text-[var(--origami-warning-text)]">
                      Desglose por Mecánica de Juego
                    </h4>
                    <div
                      role="region"
                      tabIndex={0}
                      aria-label="Práctica del grupo por mecánica"
                      className="origami-table-scroll"
                    >
                      <table
                        aria-label="Práctica del grupo por mecánica"
                        className={styles.comparativeTable}
                      >
                        <thead className="bg-[var(--origami-warning-bg)] text-[var(--origami-warning-text)] font-semibold border-b border-[var(--origami-border-subtle)]">
                          <tr>
                            <th scope="col" className="px-3 py-2">
                              Mecánica
                            </th>
                            <th scope="col" className="px-3 py-2">
                              Partidas
                            </th>
                            <th scope="col" className="px-3 py-2">
                              Juegos distintos
                            </th>
                            <th scope="col" className="px-3 py-2">
                              Tiempo practicado
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--origami-border-subtle)] bg-[var(--origami-surface)]">
                          {groupData.gamesPractice.byMechanic.map((m) => (
                            <tr key={m.mechanic}>
                              <td className="px-3 py-2 font-medium capitalize text-[var(--origami-text-primary)]">
                                {m.mechanic.replace('_', ' ')}
                              </td>
                              <td className="px-3 py-2 text-[var(--origami-text-secondary)]">
                                {m.sessionsCount}
                              </td>
                              <td className="px-3 py-2 text-[var(--origami-text-secondary)]">
                                {m.uniqueGamesCount}
                              </td>
                              <td className="px-3 py-2 text-[var(--origami-text-secondary)]">
                                {formatDuration(m.practiceTimeSeconds)}
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

          {/* Students Table with 30d and 7d trend columns */}
          {groupData && (
            <div className="origami-card">
              <div
                role="region"
                tabIndex={0}
                aria-label="Comparación de alumnos del grupo"
                className="origami-table-scroll"
              >
                <table
                  aria-label="Comparación de alumnos del grupo"
                  className={styles.comparativeTable}
                >
                  <thead className="bg-[var(--origami-surface-soft)] text-[var(--origami-text-secondary)] font-semibold border-b border-[var(--origami-border-subtle)]">
                    <tr>
                      <th
                        scope="col"
                        aria-sort={
                          groupSortBy === 'studentName'
                            ? groupSortOrder === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          className="origami-button origami-button--text"
                          onClick={() => {
                            setGroupSortBy('studentName');
                            setGroupSortOrder((prev) =>
                              prev === 'asc' ? 'desc' : 'asc',
                            );
                          }}
                        >
                          Alumno{' '}
                          {groupSortBy === 'studentName' && (
                            <span aria-hidden="true">
                              {groupSortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Nivel
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Segmento
                      </th>
                      <th
                        scope="col"
                        aria-sort={
                          groupSortBy === 'averageScore'
                            ? groupSortOrder === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          className="origami-button origami-button--text"
                          onClick={() => {
                            setGroupSortBy('averageScore');
                            setGroupSortOrder((prev) =>
                              prev === 'asc' ? 'desc' : 'asc',
                            );
                          }}
                        >
                          Promedio{' '}
                          {groupSortBy === 'averageScore' && (
                            <span aria-hidden="true">
                              {groupSortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th scope="col" className="px-4 py-3">
                        {trendMode === '7d' ? 'Tendencia 7d' : 'Tendencia 30d'}
                      </th>
                      <th
                        scope="col"
                        aria-sort={
                          groupSortBy === 'activeWeeksInPeriod'
                            ? groupSortOrder === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          className="origami-button origami-button--text"
                          onClick={() => {
                            setGroupSortBy('activeWeeksInPeriod');
                            setGroupSortOrder((prev) =>
                              prev === 'asc' ? 'desc' : 'asc',
                            );
                          }}
                        >
                          Semanas activas{' '}
                          {groupSortBy === 'activeWeeksInPeriod' && (
                            <span aria-hidden="true">
                              {groupSortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th
                        scope="col"
                        aria-sort={
                          groupSortBy === 'currentStreakWeeks'
                            ? groupSortOrder === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          className="origami-button origami-button--text"
                          onClick={() => {
                            setGroupSortBy('currentStreakWeeks');
                            setGroupSortOrder((prev) =>
                              prev === 'asc' ? 'desc' : 'asc',
                            );
                          }}
                        >
                          Racha vigente{' '}
                          {groupSortBy === 'currentStreakWeeks' && (
                            <span aria-hidden="true">
                              {groupSortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th
                        scope="col"
                        aria-sort={
                          groupSortBy === 'completionRatePercent'
                            ? groupSortOrder === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          className="origami-button origami-button--text"
                          onClick={() => {
                            setGroupSortBy('completionRatePercent');
                            setGroupSortOrder((prev) =>
                              prev === 'asc' ? 'desc' : 'asc',
                            );
                          }}
                        >
                          Cumplimiento{' '}
                          {groupSortBy === 'completionRatePercent' && (
                            <span aria-hidden="true">
                              {groupSortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th
                        scope="col"
                        aria-sort={
                          groupSortBy === 'timeSpentSeconds'
                            ? groupSortOrder === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          className="origami-button origami-button--text"
                          onClick={() => {
                            setGroupSortBy('timeSpentSeconds');
                            setGroupSortOrder((prev) =>
                              prev === 'asc' ? 'desc' : 'asc',
                            );
                          }}
                        >
                          Tiempo{' '}
                          {groupSortBy === 'timeSpentSeconds' && (
                            <span aria-hidden="true">
                              {groupSortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Última actividad
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--origami-border-subtle)]">
                    {groupData.students.map((st) => (
                      <tr
                        key={st.studentId}
                        className="hover:bg-[var(--origami-surface-soft)]"
                      >
                        <td className="px-4 py-3 font-medium text-[var(--origami-text-primary)]">
                          <Link
                            href={`/estadisticas/estudiantes/${st.studentId}`}
                            className="text-[var(--origami-info-text)] hover:underline font-semibold underline underline-offset-4"
                          >
                            {st.studentName}
                          </Link>
                          {!st.isCurrentMember && (
                            <span className="ml-2 text-[10px] text-[var(--origami-text-secondary)] bg-[var(--origami-surface-raised)] px-1.5 py-0.5 rounded">
                              Ex-miembro
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">{st.level}</td>
                        <td className="px-3 py-3 capitalize">
                          {st.ageSegment}
                        </td>
                        <td className="px-4 py-3 font-bold text-[var(--origami-info-text)]">
                          {formatScore(st.averageScore)}
                        </td>
                        <td className="px-4 py-3">
                          <TrendBadge
                            direction={st.scoreTrend}
                            delta={st.scoreTrendDelta ?? null}
                          />
                        </td>
                        <td className="px-3 py-3">{st.activeWeeksInPeriod}</td>
                        <td className="px-3 py-3">
                          <span className="font-semibold text-[var(--origami-text-primary)]">
                            {st.currentStreakWeeks} sem
                          </span>
                          {st.forgivenessAvailable && (
                            <span className="ml-1 text-[10px] text-[var(--origami-success-text)] bg-[var(--origami-success-bg)] px-1 rounded font-medium">
                              Perdón disp.
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {st.completionRatePercent !== null ? (
                            <span>
                              {st.completionRatePercent}% (
                              {st.completedAssignedCount}/{st.assignedCount})
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-[var(--origami-text-secondary)]">
                          {formatDuration(st.timeSpentSeconds)}
                        </td>
                        <td className="px-3 py-3 text-[var(--origami-text-secondary)]">
                          {st.lastActivityAt
                            ? new Date(st.lastActivityAt).toLocaleDateString(
                                'es-CO',
                                { timeZone: 'America/Bogota' },
                              )
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
        <div className="space-y-6 min-w-0">
          {/* Privacy Disclaimer (RF-8) */}
          <div className="bg-[var(--origami-warning-bg)] border border-[var(--origami-border-subtle)] rounded-xl p-4 text-xs text-[var(--origami-warning-text)] flex items-start gap-3">
            <span className="text-base">🔒</span>
            <div>
              <p className="font-semibold">Aviso de confidencialidad docente</p>
              <p className="mt-0.5 text-[var(--origami-warning-text)]">
                Este leaderboard es exclusivo para el equipo docente. Los
                estudiantes no tienen acceso a rankings, puestos ni comparativas
                entre compañeros en el portal del alumno.
              </p>
            </div>
          </div>

          {/* Filters Bar: Level Groups and Specific Group (Decisión 115) */}
          <div className="origami-card flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-[var(--origami-text-secondary)]">
                Filtrar por Nivel:
              </span>
              <div className="flex flex-wrap gap-2">
                {['', 'A1', 'A2', 'B1', 'B2'].map((lvl) => (
                  <button
                    aria-pressed={leaderboardLevel === lvl}
                    key={lvl}
                    type="button"
                    onClick={() => setLeaderboardLevel(lvl)}
                    className={
                      'origami-button origami-button--secondary' +
                      (leaderboardLevel === lvl ? ' origami-selected' : '')
                    }
                  >
                    {lvl === '' ? 'Todos' : lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label
                htmlFor="leaderboard-group-select"
                className="origami-label"
              >
                Grupo:
              </label>
              <select
                id="leaderboard-group-select"
                name="leaderboardGroupId"
                aria-label="Filtrar por grupo"
                value={leaderboardGroupId}
                onChange={(e) => setLeaderboardGroupId(e.target.value)}
                className="origami-field"
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
            <div className="origami-card">
              <div
                role="region"
                tabIndex={0}
                aria-label="Clasificación de notas"
                className="origami-table-scroll"
              >
                <table
                  aria-label="Clasificación de notas"
                  className={styles.comparativeTable}
                >
                  <thead className="bg-[var(--origami-surface-soft)] text-[var(--origami-text-secondary)] font-semibold border-b border-[var(--origami-border-subtle)]">
                    <tr>
                      <th scope="col" className="px-4 py-3 w-16 text-center">
                        Puesto
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Alumno
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Nivel
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Segmento
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Grupo
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Nota promedio
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Actividades completadas
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Racha actual
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Insignias
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--origami-border-subtle)]">
                    {leaderboardData.entries.map((entry) => (
                      <tr
                        key={entry.studentId}
                        className={`hover:bg-[var(--origami-surface-soft)] ${
                          entry.rank <= 3
                            ? 'bg-[var(--origami-warning-bg)] font-medium'
                            : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-center font-bold">
                          {entry.rank === 1
                            ? '🥇 1'
                            : entry.rank === 2
                              ? '🥈 2'
                              : entry.rank === 3
                                ? '🥉 3'
                                : `#${entry.rank}`}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[var(--origami-text-primary)]">
                          <Link
                            href={`/estadisticas/estudiantes/${entry.studentId}`}
                            className="text-[var(--origami-info-text)] hover:underline underline underline-offset-4"
                          >
                            {entry.studentName}
                          </Link>
                        </td>
                        <td className="px-3 py-3">{entry.level}</td>
                        <td className="px-3 py-3 capitalize">
                          {entry.ageSegment}
                        </td>
                        <td className="px-4 py-3 text-[var(--origami-text-secondary)]">
                          {entry.groupName || 'Sin grupo'}
                        </td>
                        <td className="px-4 py-3 font-bold text-[var(--origami-info-text)]">
                          {formatScore(entry.averageScore)}
                        </td>
                        <td className="px-4 py-3">
                          {entry.completedActivitiesCount}
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--origami-text-primary)]">
                          {entry.currentStreakWeeks} sem
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--origami-warning-text)]">
                          ⭐ {entry.badgesCount}
                        </td>
                      </tr>
                    ))}
                    {leaderboardData.entries.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-8 text-center text-[var(--origami-text-secondary)]"
                        >
                          No hay alumnos registrados que cumplan los criterios
                          seleccionados.
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
        <div className="space-y-6 min-w-0">
          {/* Privacy Disclaimer */}
          <div className="bg-[var(--origami-warning-bg)] border border-[var(--origami-border-subtle)] rounded-xl p-4 text-xs text-[var(--origami-warning-text)] flex items-start gap-3">
            <span className="text-base">🔒</span>
            <div>
              <p className="font-semibold">
                Aviso de confidencialidad docente — Ranking de Juegos
              </p>
              <p className="mt-0.5 text-[var(--origami-warning-text)]">
                Este ranking registra la práctica autónoma de microjuegos y es
                exclusivo del equipo docente. Los microjuegos están excluidos
                del promedio de notas escolar.
              </p>
            </div>
          </div>

          {/* Filters Bar: Level and Group */}
          <div className="origami-card flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-[var(--origami-text-secondary)]">
                Filtrar por Nivel:
              </span>
              <div className="flex flex-wrap gap-2">
                {['', 'A1', 'A2', 'B1', 'B2'].map((lvl) => (
                  <button
                    aria-pressed={leaderboardLevel === lvl}
                    key={lvl}
                    type="button"
                    onClick={() => setLeaderboardLevel(lvl)}
                    className={
                      'origami-button origami-button--secondary' +
                      (leaderboardLevel === lvl ? ' origami-selected' : '')
                    }
                  >
                    {lvl === '' ? 'Todos' : lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label
                htmlFor="games-leaderboard-group-select"
                className="origami-label"
              >
                Grupo:
              </label>
              <select
                id="games-leaderboard-group-select"
                name="gamesLeaderboardGroupId"
                aria-label="Filtrar por grupo en ranking de juegos"
                value={leaderboardGroupId}
                onChange={(e) => setLeaderboardGroupId(e.target.value)}
                className="origami-field"
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
            <div className="origami-card">
              <div
                role="region"
                tabIndex={0}
                aria-label="Clasificación de práctica en juegos"
                className="origami-table-scroll"
              >
                <table
                  aria-label="Clasificación de práctica en juegos"
                  className={styles.comparativeTable}
                >
                  <thead className="bg-[var(--origami-surface-soft)] text-[var(--origami-text-secondary)] font-semibold border-b border-[var(--origami-border-subtle)]">
                    <tr>
                      <th scope="col" className="px-4 py-3 w-16 text-center">
                        Puesto
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Alumno
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Nivel
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Grupo
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Puntos de juego
                      </th>
                      <th scope="col" className="px-4 py-3 text-center">
                        Estrellas
                      </th>
                      <th scope="col" className="px-4 py-3 text-center">
                        Partidas
                      </th>
                      <th scope="col" className="px-4 py-3 text-center">
                        Juegos distintos
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Tiempo de práctica
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Última partida
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--origami-border-subtle)]">
                    {gamesLeaderboardData.items.map((item) => (
                      <tr
                        key={item.studentId}
                        className={`hover:bg-[var(--origami-surface-soft)] ${
                          item.rank <= 3
                            ? 'bg-[var(--origami-warning-bg)] font-medium'
                            : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-center font-bold">
                          {item.rank === 1
                            ? '🥇 1'
                            : item.rank === 2
                              ? '🥈 2'
                              : item.rank === 3
                                ? '🥉 3'
                                : `#${item.rank}`}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[var(--origami-text-primary)]">
                          <Link
                            href={`/estadisticas/estudiantes/${item.studentId}`}
                            className="text-[var(--origami-info-text)] hover:underline underline underline-offset-4"
                          >
                            {item.studentName}
                          </Link>
                        </td>
                        <td className="px-3 py-3">{item.level}</td>
                        <td className="px-4 py-3 text-[var(--origami-text-secondary)]">
                          {item.groupName || 'Sin grupo'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-[var(--origami-warning-text)]">
                          {item.gamePoints} pts
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-[var(--origami-warning-text)]">
                          ⭐ {item.totalStars}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.gamesPlayedCount}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.uniqueGamesPlayed}
                        </td>
                        <td className="px-4 py-3 text-[var(--origami-text-secondary)]">
                          {formatDuration(item.practiceTimeSeconds)}
                        </td>
                        <td className="px-4 py-3 text-[var(--origami-text-secondary)]">
                          {item.lastPlayedAt
                            ? new Date(item.lastPlayedAt).toLocaleDateString(
                                'es-CO',
                                { timeZone: 'America/Bogota' },
                              )
                            : '—'}
                        </td>
                      </tr>
                    ))}
                    {gamesLeaderboardData.items.length === 0 && (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-4 py-8 text-center text-[var(--origami-text-secondary)]"
                        >
                          Sin partidas de microjuegos registradas en el periodo
                          seleccionado.
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
