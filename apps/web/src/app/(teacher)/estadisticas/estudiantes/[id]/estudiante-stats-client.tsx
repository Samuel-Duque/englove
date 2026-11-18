'use client';

import styles from '../../../origami-management.module.css';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import {
  StudentStatsResponse,
  StudentStatsResponseSchema,
  WeekCalendarStatus,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../../../lib/api';
import { POLLING_INTERVAL_MS } from '../../../../../lib/query-client';

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

function WeekStatusBadge({ status }: { status: WeekCalendarStatus }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--origami-success-bg)] text-[var(--origami-success-text)] border border-[var(--origami-border-subtle)]">
        Activa ✓
      </span>
    );
  }
  if (status === 'forgiven') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--origami-warning-bg)] text-[var(--origami-warning-text)] border border-[var(--origami-border-subtle)]">
        Perdón aplicado 🛡️
      </span>
    );
  }
  if (status === 'current_pending') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--origami-info-bg)] text-[var(--origami-info-text)] border border-[var(--origami-border-subtle)]">
        En curso ⏳
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--origami-surface-raised)] text-[var(--origami-text-secondary)] border border-[var(--origami-border-subtle)]">
      Inactiva
    </span>
  );
}

export function EstudianteStatsClient({ studentId }: { studentId: string }) {
  // Query Filters
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');

  // Time bucket view tab
  const [timeBucketMode, setTimeBucketMode] = useState<
    'daily' | 'weekly' | 'monthly'
  >('weekly');

  // Data & State: TanStack Query con polling de 30 s (SPEC-08 RF-7, A2)
  const params = new URLSearchParams();
  if (fromDate) params.set('from', new Date(fromDate).toISOString());
  if (toDate) params.set('to', new Date(toDate).toISOString());
  if (selectedType) params.set('type', selectedType);
  if (selectedLevel) params.set('level', selectedLevel);
  const queryString = params.toString();

  const studentStatsQuery = useQuery({
    queryKey: ['stats', 'student', studentId, queryString],
    queryFn: () =>
      apiFetch<StudentStatsResponse>(
        `/api/v1/stats/students/${studentId}?${queryString}`,
        { schema: StudentStatsResponseSchema },
      ),
    refetchInterval: POLLING_INTERVAL_MS,
  });
  const data = studentStatsQuery.data ?? null;
  const isLoading = studentStatsQuery.isPending;
  const errorMessage = studentStatsQuery.error
    ? studentStatsQuery.error instanceof ApiError
      ? studentStatsQuery.error.message
      : 'Error al cargar la información del estudiante'
    : null;
  const fetchStudentStats = (_showLoading?: boolean) => {
    void studentStatsQuery.refetch();
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Navigation Breadcrumb */}
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-[var(--origami-text-secondary)]">
        <Link
          href="/estadisticas"
          className="hover:text-[var(--origami-text-primary)] transition-colors underline underline-offset-4"
        >
          Estadísticas
        </Link>
        <span>/</span>
        <span className="text-[var(--origami-text-primary)] font-semibold">
          {data ? data.student.name : 'Ficha de estudiante'}
        </span>
      </div>

      {/* Header Profile */}
      <div className="origami-card flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="origami-page-title text-[var(--origami-text-primary)]">
              {data?.student.name ?? 'Estudiante'}
            </h1>
            {data && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--origami-info-bg)] text-[var(--origami-info-text)] border border-[var(--origami-border-subtle)]">
                Nivel {data.student.level}
              </span>
            )}
            {data && (
              <span className="flex flex-wrap items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--origami-surface-raised)] text-[var(--origami-text-secondary)] capitalize">
                {data.student.ageSegment}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--origami-text-secondary)] mt-1">
            Grupo:{' '}
            <strong className="text-[var(--origami-text-primary)]">
              {data?.student.groupName || 'Sin grupo'}
            </strong>{' '}
            • Registrado el:{' '}
            {data?.student.joinedAt
              ? new Date(data.student.joinedAt).toLocaleDateString('es-CO', {
                  timeZone: 'America/Bogota',
                })
              : '—'}
          </p>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--origami-text-secondary)] bg-[var(--origami-surface-raised)] px-3 py-1 rounded-full">
            <span className="h-2 w-2 rounded-full bg-[var(--origami-success-text)]" />
            Polling cada 30 s
          </span>
          <button
            type="button"
            onClick={() => fetchStudentStats(true)}
            disabled={isLoading}
            className="origami-button origami-button--secondary"
          >
            Refrescar
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="origami-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-[var(--origami-text-secondary)]">
            Filtros:
          </span>
          <div className="flex items-center gap-1.5">
            <label htmlFor="student-filter-from" className="origami-label">
              Desde:
            </label>
            <input
              id="student-filter-from"
              name="student-filter-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="origami-field"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="student-filter-to" className="origami-label">
              Hasta:
            </label>
            <input
              id="student-filter-to"
              name="student-filter-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="origami-field"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="student-filter-type" className="origami-label">
              Tipo:
            </label>
            <select
              id="student-filter-type"
              name="student-filter-type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="origami-field"
            >
              <option value="">Todos los tipos</option>
              <option value="fill_blank">Completar espacios</option>
              <option value="open_question">Pregunta abierta</option>
              <option value="speaking">Pronunciación / Speaking</option>
              <option value="exam">Examen</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="student-filter-level" className="origami-label">
              Nivel:
            </label>
            <select
              id="student-filter-level"
              name="student-filter-level"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="origami-field"
            >
              <option value="">Todos los niveles</option>
              <option value="A1">A1</option>
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
            </select>
          </div>
        </div>

        {(fromDate || toDate || selectedType || selectedLevel) && (
          <button
            type="button"
            onClick={() => {
              setFromDate('');
              setToDate('');
              setSelectedType('');
              setSelectedLevel('');
            }}
            className="origami-button origami-button--text"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Error Message with Retry */}
      {errorMessage && (
        <div className="rounded-xl border border-[var(--origami-border-subtle)] bg-[var(--origami-error-bg)] p-4 text-sm text-[var(--origami-error-text)] flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => fetchStudentStats(true)}
            className="origami-button"
          >
            Reintentar ahora
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 bg-[var(--origami-border-subtle)] rounded-xl"
              />
            ))}
          </div>
          <div className="h-64 bg-[var(--origami-border-subtle)] rounded-xl" />
        </div>
      )}

      {!isLoading && data && (
        <div className="space-y-8">
          {/* EJE 1: RENDIMIENTO (RF-9) */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between border-b border-[var(--origami-border-subtle)] pb-2">
              <h2 className="origami-section-title text-[var(--origami-text-primary)] flex items-center gap-2">
                <span>📊</span> Eje de Rendimiento Escolar
              </h2>
              <span className="text-xs font-medium text-[var(--origami-text-secondary)]">
                Umbral de aprobación:{' '}
                <strong>{formatScore(data.performance.passingScore)}</strong>
              </span>
            </div>

            {/* Performance KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="origami-card">
                <span className="text-xs font-medium text-[var(--origami-text-secondary)]">
                  Promedio del alumno
                </span>
                <p className="text-3xl font-extrabold text-[var(--origami-info-text)] mt-1">
                  {formatScore(data.performance.studentAverageScore)}
                </p>
                <p className="text-[11px] text-[var(--origami-text-secondary)] mt-1">
                  Promedio del grupo:{' '}
                  <strong className="text-[var(--origami-text-secondary)]">
                    {formatScore(data.performance.groupAverageScore)}
                  </strong>
                </p>
              </div>

              <div className="origami-card">
                <span className="text-xs font-medium text-[var(--origami-text-secondary)]">
                  Tasa de aprobación
                </span>
                <p className="text-3xl font-extrabold text-[var(--origami-success-text)] mt-1">
                  {data.performance.passRatePercent !== null
                    ? `${data.performance.passRatePercent}%`
                    : '—'}
                </p>
                <p className="text-[11px] text-[var(--origami-text-secondary)] mt-1">
                  {data.performance.passedCount} aprobadas /{' '}
                  {data.performance.totalGradedActivities} calificadas
                </p>
              </div>

              <div className="origami-card">
                <span className="text-xs font-medium text-[var(--origami-text-secondary)]">
                  Aprobadas vs Por mejorar
                </span>
                <div className="flex items-center gap-4 mt-2">
                  <div className="text-center">
                    <span className="text-2xl font-bold text-[var(--origami-success-text)]">
                      {data.performance.passedCount}
                    </span>
                    <span className="block text-[10px] text-[var(--origami-success-text)] font-medium">
                      Aprobadas
                    </span>
                  </div>
                  <div className="h-8 w-px bg-[var(--origami-border-subtle)]" />
                  <div className="text-center">
                    <span className="text-2xl font-bold text-[var(--origami-error-text)]">
                      {data.performance.needsImprovementCount}
                    </span>
                    <span className="block text-[10px] text-[var(--origami-error-text)] font-medium">
                      Por mejorar
                    </span>
                  </div>
                </div>
              </div>

              <div className="origami-card">
                <span className="text-xs font-medium text-[var(--origami-text-secondary)]">
                  Total calificadas en periodo
                </span>
                <p className="text-3xl font-extrabold text-[var(--origami-text-primary)] mt-1">
                  {data.performance.totalGradedActivities}
                </p>
                <p className="text-[11px] text-[var(--origami-text-secondary)] mt-1">
                  Solo actividades asignadas obligatorias
                </p>
              </div>
            </div>

            {/* Score Series Table */}
            <div className="origami-card space-y-3">
              <h3 className="origami-card-title text-[var(--origami-text-primary)]">
                Historial cronológico de notas (
                {data.performance.scoreSeries.length} entregas)
              </h3>
              <div
                role="region"
                tabIndex={0}
                aria-label="Historial cronológico de notas"
                className="origami-table-scroll"
              >
                <table
                  aria-label="Historial cronológico de notas"
                  className={styles.comparativeTable}
                >
                  <thead className="bg-[var(--origami-surface-soft)] text-[var(--origami-text-secondary)] font-semibold border-b border-[var(--origami-border-subtle)]">
                    <tr>
                      <th scope="col" className="px-4 py-2.5">
                        Actividad
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Tipo
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Mecánica / Detalle
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Nivel
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-center">
                        Intento
                      </th>
                      <th scope="col" className="px-4 py-2.5">
                        Calificación
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Estado
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Banderas
                      </th>
                      <th scope="col" className="px-4 py-2.5">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--origami-border-subtle)]">
                    {data.performance.scoreSeries.map((item) => (
                      <tr
                        key={item.attemptId}
                        className="hover:bg-[var(--origami-surface-soft)]"
                      >
                        <td className="px-4 py-3 font-semibold text-[var(--origami-text-primary)]">
                          {item.activityTitle}
                        </td>
                        <td className="px-3 py-3 capitalize">
                          {item.activityType.replace('_', ' ')}
                        </td>
                        <td className="px-3 py-3 capitalize">
                          {item.gameMechanic
                            ? item.gameMechanic.replace('_', ' ')
                            : '—'}
                        </td>
                        <td className="px-3 py-3">{item.level}</td>
                        <td className="px-3 py-3 text-center font-medium">
                          #{item.attemptNumber}
                        </td>
                        <td className="px-4 py-3 font-extrabold text-[var(--origami-info-text)] text-sm">
                          {formatScore(item.score)}
                        </td>
                        <td className="px-3 py-3">
                          {item.passed ? (
                            <span className="text-[var(--origami-success-text)] bg-[var(--origami-success-bg)] px-2 py-0.5 rounded font-semibold text-[11px]">
                              Aprobada
                            </span>
                          ) : (
                            <span className="text-[var(--origami-error-text)] bg-[var(--origami-error-bg)] px-2 py-0.5 rounded font-semibold text-[11px]">
                              Por mejorar
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 space-x-1">
                          {item.usedExtendedDeadline && (
                            <span className="text-[var(--origami-info-text)] bg-[var(--origami-info-bg)] px-1.5 py-0.5 rounded text-[10px] font-medium">
                              Plazo extendido
                            </span>
                          )}
                          {/* guardrails-ignore G-C06: bandera de duracion calculada en servidor, no telemetria de terceros */}
                          {item.implausibleDuration && (
                            <span className="text-[var(--origami-warning-text)] bg-[var(--origami-warning-bg)] px-1.5 py-0.5 rounded text-[10px] font-medium">
                              Duración atípica
                            </span>
                          )}
                          {/* guardrails-ignore G-C06: bandera de duracion calculada en servidor, no telemetria de terceros */}
                          {!item.usedExtendedDeadline &&
                            !item.implausibleDuration && (
                              <span className="text-[var(--origami-text-secondary)] text-[11px]">
                                —
                              </span>
                            )}
                        </td>
                        <td className="px-4 py-3 text-[var(--origami-text-secondary)]">
                          {new Date(item.gradedAt).toLocaleDateString('es-CO', {
                            timeZone: 'America/Bogota',
                          })}
                        </td>
                      </tr>
                    ))}
                    {data.performance.scoreSeries.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-8 text-center text-[var(--origami-text-secondary)]"
                        >
                          No hay entregas calificadas en el periodo
                          seleccionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Breakdowns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* By Activity Type */}
              <div className="origami-card space-y-3">
                <h4 className="origami-card-title text-[var(--origami-text-primary)]">
                  Por Tipo de Actividad
                </h4>
                <div className="space-y-2">
                  {(data.performance.byActivityType || []).map((t) => (
                    <div
                      key={t.type}
                      className="flex items-center justify-between text-xs py-1 border-b border-[var(--origami-border-subtle)] last:border-0"
                    >
                      <span className="capitalize text-[var(--origami-text-secondary)]">
                        {t.type.replace('_', ' ')} ({t.gradedCount})
                      </span>
                      <span className="font-bold text-[var(--origami-info-text)]">
                        {formatScore(t.averageScore)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Level */}
              <div className="origami-card space-y-3">
                <h4 className="origami-card-title text-[var(--origami-text-primary)]">
                  Por Nivel MCER
                </h4>
                <div className="space-y-2">
                  {(data.performance.byLevel || []).map((l) => (
                    <div
                      key={l.level}
                      className="flex items-center justify-between text-xs py-1 border-b border-[var(--origami-border-subtle)] last:border-0"
                    >
                      <span className="font-semibold text-[var(--origami-text-secondary)]">
                        Nivel {l.level} ({l.gradedCount})
                      </span>
                      <span className="font-bold text-[var(--origami-info-text)]">
                        {formatScore(l.averageScore)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* EJE 2: CONSTANCIA (RF-10) */}
          <div className="space-y-4 pt-4 border-t border-[var(--origami-border-subtle)]">
            <h2 className="origami-section-title text-[var(--origami-text-primary)] flex items-center gap-2">
              <span>🔥</span> Eje de Constancia y Hábito de Estudio
            </h2>

            {/* Consistency KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="origami-card">
                <span className="text-xs font-medium text-[var(--origami-text-secondary)]">
                  Racha vigente
                </span>
                <p className="text-3xl font-extrabold text-[var(--origami-warning-text)] mt-1">
                  {data.consistency.currentStreakWeeks} semanas
                </p>
                <p className="text-[11px] text-[var(--origami-text-secondary)] mt-1">
                  Mejor histórica:{' '}
                  <strong className="text-[var(--origami-text-primary)]">
                    {data.consistency.bestStreakWeeks} semanas
                  </strong>
                </p>
              </div>

              <div className="origami-card">
                <span className="text-xs font-medium text-[var(--origami-text-secondary)]">
                  Perdón de racha
                </span>
                <p
                  className={`text-xl font-bold mt-2 ${
                    data.consistency.forgivenessAvailable
                      ? 'text-[var(--origami-success-text)]'
                      : 'text-[var(--origami-text-secondary)]'
                  }`}
                >
                  {data.consistency.forgivenessAvailable
                    ? 'Disponible 🛡️'
                    : 'Consumido'}
                </p>
                <p className="text-[11px] text-[var(--origami-text-secondary)] mt-1">
                  Se recupera tras 2 semanas consecutivas activas
                </p>
              </div>

              <div className="origami-card">
                <span className="text-xs font-medium text-[var(--origami-text-secondary)]">
                  Cumplimiento asignaciones
                </span>
                <p className="text-3xl font-extrabold text-[var(--origami-info-text)] mt-1">
                  {data.consistency.completionRatePercent !== null
                    ? `${data.consistency.completionRatePercent}%`
                    : '—'}
                </p>
                <p className="text-[11px] text-[var(--origami-text-secondary)] mt-1">
                  {data.consistency.completedAssignedCount} de{' '}
                  {data.consistency.assignedCount} asignaciones obligatorias
                </p>
              </div>

              <div className="origami-card">
                <span className="text-xs font-medium text-[var(--origami-text-secondary)]">
                  Tiempo total dedicado
                </span>
                <p className="text-3xl font-extrabold text-[var(--origami-text-primary)] mt-1">
                  {formatDuration(data.consistency.totalTimeSpentSeconds)}
                </p>
                <p className="text-[11px] text-[var(--origami-text-secondary)] mt-1">
                  {data.consistency.completedActivitiesInPeriod} entregas
                  completadas en periodo
                </p>
              </div>
            </div>

            {/* Práctica en Juegos (Práctica autónoma, Decision 137, ENG-162) */}
            {data.gamesPractice && (
              <div className="bg-[var(--origami-warning-bg)] border border-[var(--origami-border-subtle)] rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-xl" aria-hidden="true">
                      🎮
                    </span>
                    <h3 className="origami-card-title text-[var(--origami-warning-text)]">
                      Práctica en Juegos
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-[var(--origami-warning-text)] bg-[var(--origami-warning-bg)] border border-[var(--origami-border-control)] px-2.5 py-0.5 rounded-full">
                    Práctica autónoma (excluida de notas académicas)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[var(--origami-surface)] p-3 rounded-lg border border-[var(--origami-border-subtle)]">
                    <span className="text-xs text-[var(--origami-text-secondary)] font-medium">
                      Partidas jugadas
                    </span>
                    <p className="text-lg font-bold text-[var(--origami-text-primary)]">
                      {data.gamesPractice.totalSessions}
                    </p>
                  </div>
                  <div className="bg-[var(--origami-surface)] p-3 rounded-lg border border-[var(--origami-border-subtle)]">
                    <span className="text-xs text-[var(--origami-text-secondary)] font-medium">
                      Juegos distintos explorados
                    </span>
                    <p className="text-lg font-bold text-[var(--origami-text-primary)]">
                      {data.gamesPractice.uniqueGamesPlayed}
                    </p>
                  </div>
                  <div className="bg-[var(--origami-surface)] p-3 rounded-lg border border-[var(--origami-border-subtle)]">
                    <span className="text-xs text-[var(--origami-text-secondary)] font-medium">
                      Tiempo de práctica
                    </span>
                    <p className="text-lg font-bold text-[var(--origami-text-primary)]">
                      {formatDuration(
                        data.gamesPractice.totalPracticeTimeSeconds,
                      )}
                    </p>
                  </div>
                </div>

                {data.gamesPractice.byMechanic &&
                  data.gamesPractice.byMechanic.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h4 className="origami-card-title text-[var(--origami-warning-text)]">
                        Desglose por Mecánica
                      </h4>
                      <div
                        role="region"
                        tabIndex={0}
                        aria-label="Práctica por mecánica"
                        className="origami-table-scroll"
                      >
                        <table
                          aria-label="Práctica por mecánica"
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
                            {data.gamesPractice.byMechanic.map((m) => (
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

                {data.gamesPractice.sessions &&
                data.gamesPractice.sessions.length > 0 ? (
                  <div className="space-y-2 pt-2">
                    <h4 className="origami-card-title text-[var(--origami-warning-text)]">
                      Historial cronológico de partidas (Bogotá)
                    </h4>
                    <div
                      role="region"
                      tabIndex={0}
                      aria-label="Sesiones de práctica recientes"
                      className="origami-table-scroll"
                    >
                      <table
                        aria-label="Sesiones de práctica recientes"
                        className={styles.comparativeTable}
                      >
                        <thead className="bg-[var(--origami-warning-bg)] text-[var(--origami-warning-text)] font-semibold border-b border-[var(--origami-border-subtle)]">
                          <tr>
                            <th scope="col" className="px-3 py-2">
                              Fecha y hora
                            </th>
                            <th scope="col" className="px-3 py-2">
                              Microjuego
                            </th>
                            <th scope="col" className="px-3 py-2">
                              Mecánica
                            </th>
                            <th scope="col" className="px-3 py-2">
                              Estrellas
                            </th>
                            <th scope="col" className="px-3 py-2">
                              Duración
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--origami-border-subtle)] bg-[var(--origami-surface)]">
                          {data.gamesPractice.sessions.map((s, idx) => (
                            <tr key={s.attemptId}>
                              <td className="px-3 py-2 text-[var(--origami-text-secondary)]">
                                {s.playedAtBogota}
                              </td>
                              <td className="px-3 py-2 font-bold text-[var(--origami-text-primary)]">
                                #{idx + 1} {s.activityTitle}
                              </td>
                              <td className="px-3 py-2 capitalize text-[var(--origami-text-secondary)]">
                                {s.mechanic
                                  ? s.mechanic.replace('_', ' ')
                                  : '—'}
                              </td>
                              <td className="px-3 py-2 font-bold text-[var(--origami-warning-text)]">
                                {'⭐'.repeat(s.stars || 0)} ({s.stars})
                              </td>
                              <td className="px-3 py-2 text-[var(--origami-text-secondary)]">
                                {formatDuration(s.durationSeconds)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--origami-text-secondary)] pt-1">
                    Sin partidas registradas en el periodo seleccionado.
                  </p>
                )}
              </div>
            )}

            {/* Weekly Calendar (12 ISO Weeks) */}
            <div className="origami-card space-y-4">
              <div className="flex min-w-0 flex-wrap items-center justify-between">
                <h3 className="origami-card-title text-[var(--origami-text-primary)]">
                  Calendario de constancia semanal (últimas 12 semanas ISO)
                </h3>
                <span className="text-xs text-[var(--origami-text-secondary)]">
                  Evaluado en zona horaria America/Bogota
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {data.consistency.weeklyCalendar.map((wk) => (
                  <div
                    key={wk.weekKey}
                    className="border border-[var(--origami-border-subtle)] rounded-lg p-3 bg-[var(--origami-surface-soft)] flex flex-col justify-between space-y-2"
                  >
                    <div>
                      <span className="text-xs font-bold text-[var(--origami-text-primary)]">
                        {wk.weekKey}
                      </span>
                      <span className="block text-[10px] text-[var(--origami-text-secondary)]">
                        Desde: {wk.weekStart}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--origami-text-secondary)]">
                        {wk.completedCount} entregas
                      </span>
                      <WeekStatusBadge status={wk.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Time Spent Breakdown Tabs */}
            <div className="origami-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="origami-card-title text-[var(--origami-text-primary)]">
                  Desglose de tiempo de estudio
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    aria-pressed={timeBucketMode === 'daily'}
                    type="button"
                    onClick={() => setTimeBucketMode('daily')}
                    className={
                      'origami-button origami-button--secondary' +
                      (timeBucketMode === 'daily' ? ' origami-selected' : '')
                    }
                  >
                    Por Día
                  </button>
                  <button
                    aria-pressed={timeBucketMode === 'weekly'}
                    type="button"
                    onClick={() => setTimeBucketMode('weekly')}
                    className={
                      'origami-button origami-button--secondary' +
                      (timeBucketMode === 'weekly' ? ' origami-selected' : '')
                    }
                  >
                    Por Semana
                  </button>
                  <button
                    aria-pressed={timeBucketMode === 'monthly'}
                    type="button"
                    onClick={() => setTimeBucketMode('monthly')}
                    className={
                      'origami-button origami-button--secondary' +
                      (timeBucketMode === 'monthly' ? ' origami-selected' : '')
                    }
                  >
                    Por Mes
                  </button>
                </div>
              </div>

              <div
                role="region"
                tabIndex={0}
                aria-label="Desglose de tiempo de estudio"
                className="origami-table-scroll"
              >
                <table
                  aria-label="Desglose de tiempo de estudio"
                  className={styles.comparativeTable}
                >
                  <thead className="bg-[var(--origami-surface-soft)] text-[var(--origami-text-secondary)] font-semibold border-b border-[var(--origami-border-subtle)]">
                    <tr>
                      <th scope="col" className="px-4 py-2.5">
                        Periodo
                      </th>
                      <th scope="col" className="px-4 py-2.5">
                        Tiempo total dedicado
                      </th>
                      <th scope="col" className="px-4 py-2.5">
                        Actividades completadas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--origami-border-subtle)]">
                    {(timeBucketMode === 'daily'
                      ? data.consistency.dailyTime
                      : timeBucketMode === 'weekly'
                        ? data.consistency.weeklyTime
                        : data.consistency.monthlyTime
                    ).map((item) => (
                      <tr
                        key={item.bucketKey}
                        className="hover:bg-[var(--origami-surface-soft)]"
                      >
                        <td className="px-4 py-2.5 font-bold text-[var(--origami-text-primary)]">
                          {item.bucketKey}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-[var(--origami-info-text)]">
                          {formatDuration(item.timeSpentSeconds)}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--origami-text-secondary)]">
                          {item.completedCount}
                        </td>
                      </tr>
                    ))}
                    {(timeBucketMode === 'daily'
                      ? data.consistency.dailyTime
                      : timeBucketMode === 'weekly'
                        ? data.consistency.weeklyTime
                        : data.consistency.monthlyTime
                    ).length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-6 text-center text-[var(--origami-text-secondary)]"
                        >
                          No hay registros de tiempo para el rango seleccionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Entregas que no llegaron a tiempo (RF-17, SPEC-09) */}
            {data.consistency.offlineUndeliveredAttempts &&
              data.consistency.offlineUndeliveredAttempts.length > 0 && (
                <div
                  data-testid="offline-undelivered-attempts-section"
                  className="bg-[var(--origami-warning-bg)] border border-[var(--origami-border-subtle)] rounded-xl p-5 space-y-3"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <AlertTriangle
                      className="w-5 h-5 text-[var(--origami-warning-text)]"
                      aria-hidden="true"
                    />
                    <h3 className="origami-card-title text-[var(--origami-text-primary)]">
                      Entregas que no llegaron a tiempo
                    </h3>
                  </div>
                  <div className="divide-y divide-[var(--origami-border-subtle)]">
                    {data.consistency.offlineUndeliveredAttempts.map(
                      (attempt) => {
                        const startFormatted = new Date(
                          attempt.startedAt,
                        ).toLocaleDateString('es-CO', {
                          timeZone: 'America/Bogota',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        });
                        const dueFormatted = new Date(
                          attempt.completeUntil,
                        ).toLocaleString('es-CO', {
                          timeZone: 'America/Bogota',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        return (
                          <div
                            key={attempt.attemptId}
                            className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs"
                          >
                            <span className="font-semibold text-[var(--origami-text-primary)]">
                              {attempt.activityTitle}
                            </span>
                            <span className="text-[var(--origami-text-secondary)]">
                              Empezada el {startFormatted}. Se intentó enviar
                              sin conexión después del límite ({dueFormatted}).
                            </span>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
