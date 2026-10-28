'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  StatsOverviewResponse,
  GroupStatsResponse,
  LeaderboardResponse,
  GroupListResponse,
  GroupView,
  TrendComparisonMode,
  ScoreTrendDirection,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../lib/api';

type TabType = 'overview' | 'groups' | 'leaderboard';
type PeriodPreset = '7d' | '30d' | '90d' | 'custom';

function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '—';
  return score.toFixed(1);
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

function EstadisticasContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = (searchParams.get('tab') as TabType) || 'overview';
  const [activeTab, setActiveTab] = useState<TabType>(tabParam);

  // Period controls
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Groups list for dropdown
  const [groups, setGroups] = useState<GroupView[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Group tab options
  const [trendMode, setTrendMode] = useState<TrendComparisonMode>('30d');
  const [groupSortBy, setGroupSortBy] = useState<string>('studentName');
  const [groupSortOrder, setGroupSortOrder] = useState<'asc' | 'desc'>('asc');

  // Leaderboard filters
  const [leaderboardLevel, setLeaderboardLevel] = useState<string>('');
  const [leaderboardGroupId, setLeaderboardGroupId] = useState<string>('');

  // Data states
  const [overviewData, setOverviewData] = useState<StatsOverviewResponse | null>(null);
  const [groupData, setGroupData] = useState<GroupStatsResponse | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResponse | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

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
  useEffect(() => {
    apiFetch<GroupListResponse>('/api/v1/groups?archived=false&limit=100')
      .then((res) => {
        setGroups(res.items);
        if (res.items.length > 0 && !selectedGroupId) {
          setSelectedGroupId(res.items[0]?.id ?? '');
        }
      })
      .catch(() => {});
  }, [selectedGroupId]);

  // Sync tab with URL
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setErrorMessage(null);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    router.replace(`/estadisticas?${params.toString()}`);
  };

  // Main data fetch function
  const fetchData = useCallback(
    async (showLoadingSpinner = true) => {
      if (showLoadingSpinner) setIsLoading(true);
      setErrorMessage(null);

      const { from, to } = getDateRange();
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      try {
        if (activeTab === 'overview') {
          const res = await apiFetch<StatsOverviewResponse>(
            `/api/v1/stats/overview?${params.toString()}`,
          );
          setOverviewData(res);
        } else if (activeTab === 'groups') {
          if (!selectedGroupId) {
            setIsLoading(false);
            return;
          }
          params.set('trendMode', trendMode);
          params.set('sortBy', groupSortBy);
          params.set('sortOrder', groupSortOrder);
          const res = await apiFetch<GroupStatsResponse>(
            `/api/v1/stats/groups/${selectedGroupId}?${params.toString()}`,
          );
          setGroupData(res);
        } else if (activeTab === 'leaderboard') {
          if (leaderboardLevel) params.set('level', leaderboardLevel);
          if (leaderboardGroupId) params.set('groupId', leaderboardGroupId);
          const res = await apiFetch<LeaderboardResponse>(
            `/api/v1/stats/leaderboard?${params.toString()}`,
          );
          setLeaderboardData(res);
        }
        setLastRefreshedAt(new Date());
      } catch (err) {
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('Error al cargar la información estadística');
        }
      } finally {
        if (showLoadingSpinner) setIsLoading(false);
      }
    },
    [
      activeTab,
      getDateRange,
      selectedGroupId,
      trendMode,
      groupSortBy,
      groupSortOrder,
      leaderboardLevel,
      leaderboardGroupId,
    ],
  );

  // Initial and reactive fetch
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // 30s Polling (RF-7)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(false);
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

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
            Actualizado {lastRefreshedAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (cada 30 s)
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
            <label className="text-zinc-600 font-medium">Desde:</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-800"
            />
            <label className="text-zinc-600 font-medium">Hasta:</label>
            <input
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
            Leaderboard Privado
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
              <span className="text-xs font-medium text-zinc-500">Nota promedio</span>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {formatScore(overviewData.organizationSummary.averageScore)}
              </p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-medium text-zinc-500">Cumplimiento</span>
              <p className="text-2xl font-bold text-zinc-900 mt-1">
                {overviewData.organizationSummary.completionRatePercent !== null
                  ? `${overviewData.organizationSummary.completionRatePercent}%`
                  : '—'}
              </p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-medium text-zinc-500">Tiempo dedicado</span>
              <p className="text-2xl font-bold text-zinc-900 mt-1">
                {formatDuration(overviewData.organizationSummary.totalTimeSpentSeconds)}
              </p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs font-medium text-zinc-500">Inactivos (&gt;14d)</span>
              <p
                className={`text-2xl font-bold mt-1 ${
                  overviewData.organizationSummary.inactiveAlertsCount > 0
                    ? 'text-amber-600'
                    : 'text-zinc-900'
                }`}
              >
                {overviewData.organizationSummary.inactiveAlertsCount}
              </p>
            </div>
          </div>

          {/* Inactive Student Alerts (RF-5) */}
          {overviewData.inactiveAlerts.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                  Alertas de inactividad (últimas 2 semanas sin práctica)
                </h3>
                <span className="text-xs font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  {overviewData.inactiveAlerts.length} alumnos
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-800 bg-white rounded-lg border border-amber-200">
                  <thead className="bg-amber-100/50 text-amber-950 font-semibold border-b border-amber-200">
                    <tr>
                      <th className="px-3 py-2">Alumno</th>
                      <th className="px-3 py-2">Nivel</th>
                      <th className="px-3 py-2">Segmento</th>
                      <th className="px-3 py-2">Grupo</th>
                      <th className="px-3 py-2">Días inactivo</th>
                      <th className="px-3 py-2">Última actividad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {overviewData.inactiveAlerts.map((alert) => (
                      <tr key={alert.studentId} className="hover:bg-zinc-50">
                        <td className="px-3 py-2 font-medium text-zinc-900">
                          <Link
                            href={`/estadisticas/estudiantes/${alert.studentId}`}
                            className="text-blue-600 hover:underline"
                          >
                            {alert.studentName}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{alert.level}</td>
                        <td className="px-3 py-2 capitalize">{alert.ageSegment}</td>
                        <td className="px-3 py-2">{alert.groupName || 'Sin grupo'}</td>
                        <td className="px-3 py-2 font-semibold text-amber-700">
                          {alert.daysSinceLastActivity !== null
                            ? `${alert.daysSinceLastActivity} días`
                            : 'Nunca ha practicado'}
                        </td>
                        <td className="px-3 py-2 text-zinc-500">
                          {alert.lastActivityAt
                            ? new Date(alert.lastActivityAt).toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Level Summary Table */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-base font-semibold text-zinc-900">
              Desempeño por Nivel MCER
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-800">
                <thead className="bg-zinc-50 text-zinc-700 font-semibold border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-2.5">Nivel</th>
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
                  {overviewData.byLevel.map((lvl) => (
                    <tr key={lvl.level} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-bold text-zinc-900">{lvl.level}</td>
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

          {/* Group Summary Table */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-base font-semibold text-zinc-900">
              Desempeño por Grupo
            </h3>
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
          {/* Controls: Group Selector and Trend Comparison Toggle (Decisión 112) */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-zinc-700">Seleccionar grupo:</label>
              <select
                value={selectedGroupId}
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
                            ? new Date(st.lastActivityAt).toLocaleDateString()
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

      {/* Tab 3: Leaderboard */}
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
              <label className="text-xs font-semibold text-zinc-700">Grupo:</label>
              <select
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
    </div>
  );
}

export default function EstadisticasPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-zinc-500 text-sm">Cargando panel de estadísticas…</div>}>
      <EstadisticasContent />
    </Suspense>
  );
}
