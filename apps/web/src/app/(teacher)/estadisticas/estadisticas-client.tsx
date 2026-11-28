'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Gamepad2,
  Lock,
  RefreshCw,
  Star,
} from 'lucide-react';
import {
  GAME_MECHANIC_LABELS,
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
import styles from './estadisticas.module.css';

type TabType = 'overview' | 'groups' | 'leaderboard' | 'games-leaderboard';
type PeriodPreset = '7d' | '30d' | '90d' | 'custom';
type GroupSortColumn =
  | 'studentName'
  | 'averageScore'
  | 'activeWeeksInPeriod'
  | 'currentStreakWeeks'
  | 'completionRatePercent'
  | 'timeSpentSeconds';

const PERIOD_PRESETS: readonly PeriodPreset[] = ['7d', '30d', '90d', 'custom'];
const TAB_ORDER: readonly TabType[] = [
  'overview',
  'groups',
  'leaderboard',
  'games-leaderboard',
];
const TAB_META: ReadonlyArray<{ id: TabType; label: string }> = [
  { id: 'overview', label: 'Vista General' },
  { id: 'groups', label: 'Por Grupo' },
  { id: 'leaderboard', label: 'Leaderboard de Notas' },
  { id: 'games-leaderboard', label: 'Ranking de Juegos' },
];

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
    return <span className={styles.trendNone}>Sin referencia</span>;
  }
  if (direction === 'up') {
    return (
      <span className={`${styles.trendBadge} ${styles.trendUp}`}>
        <ArrowUp size={13} aria-hidden="true" />
        <span>+{delta.toFixed(1).replace('.', ',')}</span>
      </span>
    );
  }
  if (direction === 'down') {
    return (
      <span className={`${styles.trendBadge} ${styles.trendDown}`}>
        <ArrowDown size={13} aria-hidden="true" />
        <span>{delta.toFixed(1).replace('.', ',')}</span>
      </span>
    );
  }
  return (
    <span className={`${styles.trendBadge} ${styles.trendStable}`}>
      <ArrowRight size={13} aria-hidden="true" />
      <span>
        {delta >= 0
          ? `+${delta.toFixed(1).replace('.', ',')}`
          : delta.toFixed(1).replace('.', ',')}
      </span>
    </span>
  );
}

function GroupScoreTrendChart({
  groupName,
  students,
}: {
  groupName: string;
  students: GroupStatsResponse['students'];
}) {
  const scoredStudents = students.filter(
    (s): s is typeof s & { averageScore: number } => s.averageScore !== null,
  );
  const svgWidth = 640;
  const svgHeight = 200;
  const padLeft = 42;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 34;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const yForScore = (score: number) => {
    const clamped = Math.max(0, Math.min(5, score));
    return padTop + plotHeight - (clamped / 5) * plotHeight;
  };

  const thresholdY = yForScore(3.0);
  const points = scoredStudents.map((student, idx) => {
    const x =
      scoredStudents.length === 1
        ? padLeft + plotWidth / 2
        : padLeft + (idx / (scoredStudents.length - 1)) * plotWidth;
    const y = yForScore(student.averageScore);
    return {
      x,
      y,
      name: student.studentName,
      score: student.averageScore,
    };
  });

  const polylinePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <section className={styles.chartCard} aria-labelledby="group-trend-chart-title">
      <div className={styles.chartHeader}>
        <div>
          <h3 id="group-trend-chart-title">Desempeño académico del grupo (0,0–5,0)</h3>
          <p className={styles.chartNote}>
            Excluye microjuegos del promedio académico · Línea punteada en 3,0 (umbral de aprobación)
          </p>
        </div>
      </div>

      {points.length === 0 ? (
        <p className={styles.chartNote}>
          Aún no hay calificaciones académicas suficientes en {groupName} para graficar.
        </p>
      ) : (
        <svg
          className={styles.chartSvg}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          role="img"
          aria-label={`Tendencia académica del grupo ${groupName} en escala 0,0 a 5,0 para ${points.length} estudiantes`}
        >
          {[0, 3, 5].map((tick) => {
            const y = yForScore(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke={tick === 3 ? '#9A7B5C' : '#E4D5C3'}
                  strokeWidth={tick === 3 ? 1.5 : 1}
                  strokeDasharray={tick === 3 ? '4 4' : undefined}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#5E3E2C"
                >
                  {tick.toFixed(1).replace('.', ',')}
                </text>
              </g>
            );
          })}
          <text
            x={svgWidth - padRight}
            y={thresholdY - 6}
            textAnchor="end"
            fontSize="10"
            fill="#5E3E2C"
          >
            Umbral 3,0
          </text>
          {points.length > 1 && (
            <polyline
              fill="none"
              stroke="#C6470B"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polylinePoints}
            />
          )}
          {points.map((point) => (
            <g key={point.name}>
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="#C6470B"
                stroke="#FFFFFF"
                strokeWidth="2"
              >
                <title>{`${point.name}: ${formatScore(point.score)}`}</title>
              </circle>
              <text
                x={point.x}
                y={svgHeight - 10}
                textAnchor="middle"
                fontSize="10"
                fill="#5E3E2C"
              >
                {point.name.split(' ')[0]}
              </text>
            </g>
          ))}
        </svg>
      )}
    </section>
  );
}

export function EstadisticasClient() {
  const searchParams = useSearchParams();

  const rawTab = searchParams.get('tab');
  const tabParam: TabType = isTabType(rawTab) ? rawTab : 'overview';
  const [prevUrlTab, setPrevUrlTab] = useState<TabType>(tabParam);
  const [activeTab, setActiveTab] = useState<TabType>(tabParam);
  const [isMounted, setIsMounted] = useState(false);

  if (tabParam !== prevUrlTab) {
    setPrevUrlTab(tabParam);
    setActiveTab(tabParam);
  }

  const tabRefs = useRef<Record<TabType, HTMLButtonElement | null>>({
    overview: null,
    groups: null,
    leaderboard: null,
    'games-leaderboard': null,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [trendMode, setTrendMode] = useState<TrendComparisonMode>('30d');
  const [groupSortBy, setGroupSortBy] = useState<GroupSortColumn>('studentName');
  const [groupSortOrder, setGroupSortOrder] = useState<'asc' | 'desc'>('asc');
  const [leaderboardLevel, setLeaderboardLevel] = useState<string>('');
  const [leaderboardGroupId, setLeaderboardGroupId] = useState<string>('');

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

  const groupsQuery = useQuery({
    queryKey: ['teacher', 'groups', 'active'],
    queryFn: () =>
      apiFetch<GroupListResponse>('/api/v1/groups?archived=false&limit=100', {
        schema: GroupListResponseSchema,
      }),
  });
  const groups: GroupView[] = groupsQuery.data?.items ?? [];
  const effectiveGroupId = selectedGroupId || groups[0]?.id || '';

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    window.history.replaceState(null, '', `/estadisticas?${params.toString()}`);
  };

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: TabType,
  ) => {
    const idx = TAB_ORDER.indexOf(currentTab);
    let nextIdx: number | null = null;
    if (event.key === 'ArrowRight') nextIdx = (idx + 1) % TAB_ORDER.length;
    else if (event.key === 'ArrowLeft')
      nextIdx = (idx - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    else if (event.key === 'Home') nextIdx = 0;
    else if (event.key === 'End') nextIdx = TAB_ORDER.length - 1;
    if (nextIdx === null) return;
    event.preventDefault();
    const nextTab = TAB_ORDER[nextIdx];
    if (nextTab) {
      tabRefs.current[nextTab]?.focus();
      handleTabChange(nextTab);
    }
  };

  const toggleGroupSort = (column: GroupSortColumn) => {
    if (groupSortBy === column) {
      setGroupSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setGroupSortBy(column);
      setGroupSortOrder('asc');
    }
  };

  const ariaSortFor = (column: GroupSortColumn): 'ascending' | 'descending' | 'none' => {
    if (groupSortBy !== column) return 'none';
    return groupSortOrder === 'asc' ? 'ascending' : 'descending';
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
    queryKey: ['stats', 'group', effectiveGroupId, trendMode, groupSortBy, groupSortOrder, ...periodKey],
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
    queryKey: ['stats', 'leaderboard', leaderboardLevel, leaderboardGroupId, ...periodKey],
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
    queryKey: ['stats', 'games-leaderboard', leaderboardLevel, leaderboardGroupId, ...periodKey],
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
  const fetchData = () => {
    void activeQuery.refetch();
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Estadísticas y Desempeño</h1>
          <p className={styles.subtitle}>
            Métricas de rendimiento escolar y constancia de estudio en tiempo real
          </p>
        </div>

        <div className={styles.pollingBar}>
          <span className={styles.pollingPill}>
            <span className={styles.pollingDot} aria-hidden="true" />
            Actualizado{' '}
            {isMounted
              ? lastRefreshedAt.toLocaleTimeString('es-CO', {
                  timeZone: 'America/Bogota',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : '—'}{' '}
            · cada 30 s
          </span>
          <button
            type="button"
            onClick={fetchData}
            disabled={isLoading}
            className={styles.refreshButton}
          >
            <RefreshCw size={15} aria-hidden="true" />
            <span>Refrescar</span>
          </button>
        </div>
      </header>

      <section className={styles.filterCard} aria-label="Filtro de periodo">
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Periodo:</span>
          <div className={styles.segmented} role="group" aria-label="Rango de fechas">
            {PERIOD_PRESETS.map((preset) => {
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
                  aria-pressed={periodPreset === preset}
                  onClick={() => setPeriodPreset(preset)}
                  className={styles.segmentButton}
                >
                  {labels[preset]}
                </button>
              );
            })}
          </div>
        </div>

        {periodPreset === 'custom' && (
          <div className={styles.filterGroup}>
            <label htmlFor="stats-overview-from" className={styles.filterLabel}>
              Desde:
            </label>
            <input
              id="stats-overview-from"
              name="stats-overview-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className={styles.controlInput}
            />
            <label htmlFor="stats-overview-to" className={styles.filterLabel}>
              Hasta:
            </label>
            <input
              id="stats-overview-to"
              name="stats-overview-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className={styles.controlInput}
            />
          </div>
        )}
      </section>

      <div className={styles.tabBar}>
        <div
          className={styles.tablist}
          role="tablist"
          aria-label="Pestañas de estadísticas"
        >
          {TAB_META.map(({ id, label }) => (
            <button
              key={id}
              id={`stats-tab-${id}`}
              ref={(el) => {
                tabRefs.current[id] = el;
              }}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={activeTab === id ? `stats-panel-${id}` : undefined}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => handleTabChange(id)}
              onKeyDown={(e) => handleTabKeyDown(e, id)}
              className={styles.tab}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        id={`stats-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`stats-tab-${activeTab}`}
        className={styles.sectionStack}
      >
        {errorMessage && (
          <div role="alert" className={styles.errorBanner}>
            <span>{errorMessage}</span>
            <button type="button" onClick={fetchData} className={styles.retryButton}>
              Reintentar ahora
            </button>
          </div>
        )}

        {isLoading && (
          <div className={styles.skeletonStack} role="status">
            <span className="sr-only">Cargando estadísticas…</span>
            <div className={styles.skeletonKpiGrid} aria-hidden="true">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className={styles.skeletonBox} />
              ))}
            </div>
            <div className={styles.skeletonTable} aria-hidden="true" />
          </div>
        )}

        {!isLoading && activeTab === 'overview' && overviewData && (
          <>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Alumnos aprobados</span>
              <p className={styles.kpiValue}>
                {overviewData.organizationSummary.totalApprovedStudents}
              </p>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Activos en periodo</span>
              <p className={styles.kpiValue}>
                {overviewData.organizationSummary.activeStudentsInPeriod}
              </p>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Nota promedio general</span>
              <p className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>
                {formatScore(overviewData.organizationSummary.averageScore)}
              </p>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>% Cumplimiento</span>
              <p className={styles.kpiValue}>
                {overviewData.organizationSummary.completionRatePercent !== null
                  ? `${overviewData.organizationSummary.completionRatePercent}%`
                  : '—'}
              </p>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Tiempo total de estudio</span>
              <p className={styles.kpiValue}>
                {formatDuration(overviewData.organizationSummary.totalTimeSpentSeconds)}
              </p>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Alumnos en riesgo</span>
              <p className={`${styles.kpiValue} ${styles.kpiValueDanger}`}>
                {overviewData.organizationSummary.inactiveAlertsCount}
              </p>
            </div>
          </div>

          {overviewData.inactiveAlerts.length > 0 && (
            <section className={styles.alertBox} aria-labelledby="inactive-alerts-heading">
              <div className={styles.alertTitle}>
                <AlertTriangle size={18} aria-hidden="true" />
                <h2 id="inactive-alerts-heading">
                  Alumnos en riesgo de deserción o abandono (≥ 14 días inactivos)
                </h2>
              </div>
              <div className={styles.alertGrid}>
                {overviewData.inactiveAlerts.map((st) => (
                  <article key={st.studentId} className={styles.alertCard}>
                    <div>
                      <Link
                        href={`/estadisticas/estudiantes/${st.studentId}`}
                        className={styles.inlineLink}
                      >
                        {st.studentName}
                      </Link>
                      <div className={styles.alertMeta}>
                        <span>{st.groupName || 'Sin grupo'}</span>
                        <span>·</span>
                        <span>Nivel {st.level}</span>
                      </div>
                    </div>
                    <div className={styles.alertFooter}>
                      <span>Días sin actividad:</span>
                      <span className={styles.alertDays}>
                        {st.daysSinceLastActivity !== null
                          ? `${st.daysSinceLastActivity} días`
                          : 'Nunca'}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Desglose por Nivel MCER (A1, A2, B1, B2)</h2>
            </div>
            <div className={styles.tableWrap} role="region" aria-label="Desglose por Nivel MCER" tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Nivel</th>
                    <th scope="col">Total alumnos</th>
                    <th scope="col">Activos</th>
                    <th scope="col">Nota promedio</th>
                    <th scope="col">Asignadas</th>
                    <th scope="col">Completadas</th>
                    <th scope="col">% Cumplimiento</th>
                    <th scope="col">Tiempo dedicado</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewData.byLevel.map((lvl) => (
                    <tr key={lvl.level}>
                      <td>
                        <strong>Nivel {lvl.level}</strong>
                      </td>
                      <td>{lvl.studentCount}</td>
                      <td>{lvl.activeStudentCount}</td>
                      <td className={styles.scoreCell}>{formatScore(lvl.averageScore)}</td>
                      <td>{lvl.assignedCount}</td>
                      <td>{lvl.completedAssignedCount}</td>
                      <td>
                        {lvl.completionRatePercent !== null
                          ? `${lvl.completionRatePercent}%`
                          : '—'}
                      </td>
                      <td className={styles.mutedCell}>
                        {formatDuration(lvl.timeSpentSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Comparativa entre Grupos Activos</h2>
            </div>
            <div className={styles.tableWrap} role="region" aria-label="Comparativa entre Grupos Activos" tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Grupo</th>
                    <th scope="col">Alumnos</th>
                    <th scope="col">Activos</th>
                    <th scope="col">Nota promedio</th>
                    <th scope="col">Asignadas</th>
                    <th scope="col">Completadas</th>
                    <th scope="col">% Cumplimiento</th>
                    <th scope="col">Tiempo dedicado</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewData.byGroup.map((grp) => (
                    <tr key={grp.groupId}>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedGroupId(grp.groupId);
                            handleTabChange('groups');
                          }}
                          className={styles.inlineLinkButton}
                        >
                          {grp.groupName}
                        </button>
                      </td>
                      <td>{grp.studentCount}</td>
                      <td>{grp.activeStudentCount}</td>
                      <td className={styles.scoreCell}>{formatScore(grp.averageScore)}</td>
                      <td>{grp.assignedCount}</td>
                      <td>{grp.completedAssignedCount}</td>
                      <td>
                        {grp.completionRatePercent !== null
                          ? `${grp.completionRatePercent}%`
                          : '—'}
                      </td>
                      <td className={styles.mutedCell}>
                        {formatDuration(grp.timeSpentSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          </>
        )}

        {!isLoading && activeTab === 'groups' && (
          <>
          <section className={styles.filterCard} aria-label="Controles de grupo">
            <div className={styles.filterGroup}>
              <label htmlFor="stats-group-select" className={styles.filterLabel}>
                Seleccionar grupo:
              </label>
              <select
                id="stats-group-select"
                name="groupId"
                aria-label="Seleccionar grupo"
                value={effectiveGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className={styles.controlSelect}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Tendencia comparada:</span>
              <div className={styles.segmented} role="group" aria-label="Modo de tendencia">
                <button
                  type="button"
                  aria-pressed={trendMode === '30d'}
                  onClick={() => setTrendMode('30d')}
                  className={styles.segmentButton}
                >
                  Cada 30 días
                </button>
                <button
                  type="button"
                  aria-pressed={trendMode === '7d'}
                  onClick={() => setTrendMode('7d')}
                  className={styles.segmentButton}
                >
                  Semanal (7 días)
                </button>
              </div>
            </div>
          </section>

          {groupData && (
            <div className={styles.kpiGrid}>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Grupo</span>
                <p className={styles.kpiValue}>{groupData.group.name}</p>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Total alumnos</span>
                <p className={styles.kpiValue}>{groupData.summary.studentCount}</p>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Promedio grupo</span>
                <p className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>
                  {formatScore(groupData.summary.averageScore)}
                </p>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Actividades completadas</span>
                <p className={styles.kpiValue}>
                  {groupData.summary.completedAssignedCount} / {groupData.summary.assignedCount}
                </p>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>% Cumplimiento</span>
                <p className={styles.kpiValue}>
                  {groupData.summary.completionRatePercent !== null
                    ? `${groupData.summary.completionRatePercent}%`
                    : '—'}
                </p>
              </div>
              <div className={styles.kpiCard}>
                <span className={styles.kpiLabel}>Tiempo total</span>
                <p className={styles.kpiValue}>
                  {formatDuration(groupData.summary.timeSpentSeconds)}
                </p>
              </div>
            </div>
          )}

          {groupData && (
            <GroupScoreTrendChart
              groupName={groupData.group.name}
              students={groupData.students}
            />
          )}

          {groupData && groupData.gamesPractice && (
            <section className={styles.calloutCard} aria-labelledby="games-practice-heading">
              <div className={styles.calloutHeader}>
                <div className={styles.calloutTitle}>
                  <Gamepad2 size={18} aria-hidden="true" />
                  <h3 id="games-practice-heading">Práctica en Juegos del Grupo</h3>
                </div>
                <span className={styles.calloutBadge}>
                  Práctica autónoma (excluida de notas académicas)
                </span>
              </div>

              <div className={styles.miniKpiGrid}>
                <div className={styles.miniKpi}>
                  <span className={styles.kpiLabel}>Partidas jugadas en el grupo</span>
                  <p>{groupData.gamesPractice.totalSessions}</p>
                </div>
                <div className={styles.miniKpi}>
                  <span className={styles.kpiLabel}>Juegos distintos explorados</span>
                  <p>{groupData.gamesPractice.uniqueGamesPlayed}</p>
                </div>
                <div className={styles.miniKpi}>
                  <span className={styles.kpiLabel}>Tiempo total de práctica</span>
                  <p>{formatDuration(groupData.gamesPractice.totalPracticeTimeSeconds)}</p>
                </div>
              </div>

              {groupData.gamesPractice.byMechanic &&
                groupData.gamesPractice.byMechanic.length > 0 && (
                  <div className={styles.card}>
                    <div className={styles.cardHeader}>
                      <h4>Desglose por Mecánica de Juego</h4>
                    </div>
                    <div className={styles.tableWrap} role="region" aria-label="Desglose por Mecánica de Juego" tabIndex={0}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th scope="col">Mecánica</th>
                            <th scope="col">Partidas</th>
                            <th scope="col">Juegos distintos</th>
                            <th scope="col">Tiempo practicado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupData.gamesPractice.byMechanic.map((m) => (
                            <tr key={m.mechanic}>
                              <td>
                                <strong>{GAME_MECHANIC_LABELS[m.mechanic] ?? m.mechanic}</strong>
                              </td>
                              <td>{m.sessionsCount}</td>
                              <td>{m.uniqueGamesCount}</td>
                              <td className={styles.mutedCell}>
                                {formatDuration(m.practiceTimeSeconds)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </section>
          )}

          {groupData && (
            <section className={styles.card} aria-label="Detalle por estudiante del grupo">
              <div className={styles.tableWrap} role="region" aria-label="Detalle por estudiante del grupo" tabIndex={0}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col" aria-sort={ariaSortFor('studentName')}>
                        <button
                          type="button"
                          onClick={() => toggleGroupSort('studentName')}
                          className={styles.sortButton}
                        >
                          <span>Alumno</span>
                          {groupSortBy === 'studentName' && (
                            <span aria-hidden="true">
                              {groupSortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th scope="col">Nivel</th>
                      <th scope="col">Segmento</th>
                      <th scope="col" aria-sort={ariaSortFor('averageScore')}>
                        <button
                          type="button"
                          onClick={() => toggleGroupSort('averageScore')}
                          className={styles.sortButton}
                        >
                          <span>Promedio</span>
                          {groupSortBy === 'averageScore' && (
                            <span aria-hidden="true">
                              {groupSortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th scope="col">
                        {trendMode === '7d' ? 'Tendencia 7d' : 'Tendencia 30d'}
                      </th>
                      <th scope="col" aria-sort={ariaSortFor('activeWeeksInPeriod')}>
                        <button
                          type="button"
                          onClick={() => toggleGroupSort('activeWeeksInPeriod')}
                          className={styles.sortButton}
                        >
                          Semanas activas
                        </button>
                      </th>
                      <th scope="col" aria-sort={ariaSortFor('currentStreakWeeks')}>
                        <button
                          type="button"
                          onClick={() => toggleGroupSort('currentStreakWeeks')}
                          className={styles.sortButton}
                        >
                          Racha vigente
                        </button>
                      </th>
                      <th scope="col" aria-sort={ariaSortFor('completionRatePercent')}>
                        <button
                          type="button"
                          onClick={() => toggleGroupSort('completionRatePercent')}
                          className={styles.sortButton}
                        >
                          Cumplimiento
                        </button>
                      </th>
                      <th scope="col" aria-sort={ariaSortFor('timeSpentSeconds')}>
                        <button
                          type="button"
                          onClick={() => toggleGroupSort('timeSpentSeconds')}
                          className={styles.sortButton}
                        >
                          Tiempo
                        </button>
                      </th>
                      <th scope="col">Última actividad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupData.students.map((st) => (
                      <tr key={st.studentId}>
                        <td>
                          <Link
                            href={`/estadisticas/estudiantes/${st.studentId}`}
                            className={styles.inlineLink}
                          >
                            {st.studentName}
                          </Link>
                          {!st.isCurrentMember && (
                            <span className={styles.exMemberBadge}>Ex-miembro</span>
                          )}
                        </td>
                        <td>{st.level}</td>
                        <td className="capitalize">{st.ageSegment}</td>
                        <td className={styles.scoreCell}>{formatScore(st.averageScore)}</td>
                        <td>
                          <TrendBadge
                            direction={st.scoreTrend}
                            delta={st.scoreTrendDelta ?? null}
                          />
                        </td>
                        <td>{st.activeWeeksInPeriod}</td>
                        <td>
                          <strong>{st.currentStreakWeeks} sem</strong>
                          {st.forgivenessAvailable && (
                            <span className={styles.forgiveBadge}>Perdón disp.</span>
                          )}
                        </td>
                        <td>
                          {st.completionRatePercent !== null
                            ? `${st.completionRatePercent}% (${st.completedAssignedCount}/${st.assignedCount})`
                            : '—'}
                        </td>
                        <td className={styles.mutedCell}>
                          {formatDuration(st.timeSpentSeconds)}
                        </td>
                        <td className={styles.mutedCell}>
                          {st.lastActivityAt
                            ? new Date(st.lastActivityAt).toLocaleDateString('es-CO', {
                                timeZone: 'America/Bogota',
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          </>
        )}

        {!isLoading && activeTab === 'leaderboard' && (
          <>
          <aside className={styles.privacyBanner}>
            <Lock size={18} className={styles.privacyIcon} aria-hidden="true" />
            <div>
              <p className={styles.privacyTitle}>Aviso de confidencialidad docente</p>
              <p className={styles.privacyText}>
                Este leaderboard es exclusivo para el equipo docente. Los estudiantes no tienen
                acceso a rankings, puestos ni comparativas entre compañeros en el portal del
                alumno.
              </p>
            </div>
          </aside>

          <section className={styles.filterCard} aria-label="Filtros de leaderboard de notas">
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Filtrar por Nivel:</span>
              <div className={styles.segmented} role="group" aria-label="Nivel MCER">
                {['', 'A1', 'A2', 'B1', 'B2'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    aria-pressed={leaderboardLevel === lvl}
                    onClick={() => setLeaderboardLevel(lvl)}
                    className={styles.segmentButton}
                  >
                    {lvl === '' ? 'Todos' : lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="leaderboard-group-select" className={styles.filterLabel}>
                Grupo:
              </label>
              <select
                id="leaderboard-group-select"
                name="leaderboardGroupId"
                aria-label="Filtrar por grupo"
                value={leaderboardGroupId}
                onChange={(e) => setLeaderboardGroupId(e.target.value)}
                className={styles.controlSelect}
              >
                <option value="">Todos los grupos</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {leaderboardData && (
            <section className={styles.card}>
              <div className={styles.tableWrap} role="region" aria-label="Leaderboard de notas" tabIndex={0}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col" className={styles.centerCell}>
                        Puesto
                      </th>
                      <th scope="col">Alumno</th>
                      <th scope="col">Nivel</th>
                      <th scope="col">Segmento</th>
                      <th scope="col">Grupo</th>
                      <th scope="col">Nota promedio</th>
                      <th scope="col">Actividades completadas</th>
                      <th scope="col">Racha actual</th>
                      <th scope="col">Insignias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardData.entries.map((entry) => (
                      <tr
                        key={entry.studentId}
                        className={entry.rank <= 3 ? styles.topRankRow : undefined}
                      >
                        <td className={styles.centerCell}>
                          <strong>#{entry.rank}</strong>
                        </td>
                        <td>
                          <Link
                            href={`/estadisticas/estudiantes/${entry.studentId}`}
                            className={styles.inlineLink}
                          >
                            {entry.studentName}
                          </Link>
                        </td>
                        <td>{entry.level}</td>
                        <td className="capitalize">{entry.ageSegment}</td>
                        <td className={styles.mutedCell}>{entry.groupName || 'Sin grupo'}</td>
                        <td className={styles.scoreCell}>{formatScore(entry.averageScore)}</td>
                        <td>{entry.completedActivitiesCount}</td>
                        <td>
                          <strong>{entry.currentStreakWeeks} sem</strong>
                        </td>
                        <td className={styles.pointsBadge}>
                          <span className="inline-flex items-center gap-1">
                            <Star size={14} aria-hidden="true" />
                            {entry.badgesCount}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {leaderboardData.entries.length === 0 && (
                      <tr>
                        <td colSpan={9} className={styles.emptyCell}>
                          No hay alumnos registrados que cumplan los criterios seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          </>
        )}

        {!isLoading && activeTab === 'games-leaderboard' && (
          <>
          <aside className={styles.privacyBanner}>
            <Lock size={18} className={styles.privacyIcon} aria-hidden="true" />
            <div>
              <p className={styles.privacyTitle}>
                Aviso de confidencialidad docente — Ranking de Juegos
              </p>
              <p className={styles.privacyText}>
                Este ranking registra la práctica autónoma de microjuegos y es exclusivo del
                equipo docente. Los microjuegos están excluidos del promedio de notas escolar.
              </p>
            </div>
          </aside>

          <section className={styles.filterCard} aria-label="Filtros de ranking de juegos">
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Filtrar por Nivel:</span>
              <div className={styles.segmented} role="group" aria-label="Nivel MCER">
                {['', 'A1', 'A2', 'B1', 'B2'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    aria-pressed={leaderboardLevel === lvl}
                    onClick={() => setLeaderboardLevel(lvl)}
                    className={styles.segmentButton}
                  >
                    {lvl === '' ? 'Todos' : lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="games-leaderboard-group-select" className={styles.filterLabel}>
                Grupo:
              </label>
              <select
                id="games-leaderboard-group-select"
                name="gamesLeaderboardGroupId"
                aria-label="Filtrar por grupo en ranking de juegos"
                value={leaderboardGroupId}
                onChange={(e) => setLeaderboardGroupId(e.target.value)}
                className={styles.controlSelect}
              >
                <option value="">Todos los grupos</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {gamesLeaderboardData && (
            <section className={styles.card}>
              <div className={styles.tableWrap} role="region" aria-label="Ranking de juegos" tabIndex={0}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col" className={styles.centerCell}>
                        Puesto
                      </th>
                      <th scope="col">Alumno</th>
                      <th scope="col">Nivel</th>
                      <th scope="col">Grupo</th>
                      <th scope="col" className={styles.rightCell}>
                        Puntos de juego
                      </th>
                      <th scope="col" className={styles.centerCell}>
                        Estrellas
                      </th>
                      <th scope="col" className={styles.centerCell}>
                        Partidas
                      </th>
                      <th scope="col" className={styles.centerCell}>
                        Juegos distintos
                      </th>
                      <th scope="col">Tiempo de práctica</th>
                      <th scope="col">Última partida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gamesLeaderboardData.items.map((item) => (
                      <tr
                        key={item.studentId}
                        className={item.rank <= 3 ? styles.topRankRow : undefined}
                      >
                        <td className={styles.centerCell}>
                          <strong>#{item.rank}</strong>
                        </td>
                        <td>
                          <Link
                            href={`/estadisticas/estudiantes/${item.studentId}`}
                            className={styles.inlineLink}
                          >
                            {item.studentName}
                          </Link>
                        </td>
                        <td>{item.level}</td>
                        <td className={styles.mutedCell}>{item.groupName || 'Sin grupo'}</td>
                        <td className={`${styles.rightCell} ${styles.pointsBadge}`}>
                          {item.gamePoints} pts
                        </td>
                        <td className={`${styles.centerCell} ${styles.pointsBadge}`}>
                          <span className="inline-flex items-center gap-1">
                            <Star size={14} aria-hidden="true" />
                            {item.totalStars}
                          </span>
                        </td>
                        <td className={styles.centerCell}>{item.gamesPlayedCount}</td>
                        <td className={styles.centerCell}>{item.uniqueGamesPlayed}</td>
                        <td className={styles.mutedCell}>
                          {formatDuration(item.practiceTimeSeconds)}
                        </td>
                        <td className={styles.mutedCell}>
                          {item.lastPlayedAt
                            ? new Date(item.lastPlayedAt).toLocaleDateString('es-CO', {
                                timeZone: 'America/Bogota',
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                    {gamesLeaderboardData.items.length === 0 && (
                      <tr>
                        <td colSpan={10} className={styles.emptyCell}>
                          Sin partidas de microjuegos registradas en el periodo seleccionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          </>
        )}
      </div>
    </div>
  );
}
