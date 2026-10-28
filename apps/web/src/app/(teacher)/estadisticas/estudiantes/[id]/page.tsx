'use client';

import React, { useState, useEffect, useCallback, use, Suspense } from 'react';
import Link from 'next/link';
import {
  StudentStatsResponse,
  WeekCalendarStatus,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../../../lib/api';

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

function WeekStatusBadge({ status }: { status: WeekCalendarStatus }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
        Activa ✓
      </span>
    );
  }
  if (status === 'forgiven') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        Perdón aplicado 🛡️
      </span>
    );
  }
  if (status === 'current_pending') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
        En curso ⏳
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
      Inactiva
    </span>
  );
}

function StudentDetailContent({ studentId }: { studentId: string }) {
  // Query Filters
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');

  // Time bucket view tab
  const [timeBucketMode, setTimeBucketMode] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  // Data & State
  const [data, setData] = useState<StudentStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStudentStats = useCallback(
    async (showLoading = true) => {
      if (showLoading) setIsLoading(true);
      setErrorMessage(null);

      const params = new URLSearchParams();
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate) params.set('to', new Date(toDate).toISOString());
      if (selectedType) params.set('type', selectedType);
      if (selectedLevel) params.set('level', selectedLevel);

      try {
        const res = await apiFetch<StudentStatsResponse>(
          `/api/v1/stats/students/${studentId}?${params.toString()}`,
        );
        setData(res);
      } catch (err) {
        if (err instanceof ApiError) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('Error al cargar la información del estudiante');
        }
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [studentId, fromDate, toDate, selectedType, selectedLevel],
  );

  useEffect(() => {
    fetchStudentStats(true);
  }, [fetchStudentStats]);

  // 30s Polling (RF-7)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStudentStats(false);
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchStudentStats]);

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/estadisticas" className="hover:text-zinc-900 transition-colors">
          Estadísticas
        </Link>
        <span>/</span>
        <span className="text-zinc-800 font-semibold">
          {data ? data.student.name : 'Ficha de estudiante'}
        </span>
      </div>

      {/* Header Profile */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              {data?.student.name ?? 'Estudiante'}
            </h1>
            {data && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Nivel {data.student.level}
              </span>
            )}
            {data && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 capitalize">
                {data.student.ageSegment}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Grupo: <strong className="text-zinc-800">{data?.student.groupName || 'Sin grupo'}</strong> • Registrado el:{' '}
            {data?.student.joinedAt ? new Date(data.student.joinedAt).toLocaleDateString() : '—'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Polling cada 30 s
          </span>
          <button
            type="button"
            onClick={() => fetchStudentStats(true)}
            disabled={isLoading}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 transition-colors"
          >
            Refrescar
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-zinc-700">Filtros:</span>
          <div className="flex items-center gap-1.5">
            <label className="text-zinc-500">Desde:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-800"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-zinc-500">Hasta:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-800"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-zinc-500">Tipo:</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-800 bg-white"
            >
              <option value="">Todos los tipos</option>
              <option value="fill_blank">Completar espacios</option>
              <option value="open_question">Pregunta abierta</option>
              <option value="speaking">Pronunciación / Speaking</option>
              <option value="game">Microjuego</option>
              <option value="exam">Examen</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-zinc-500">Nivel:</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-800 bg-white"
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
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Error Message with Retry */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => fetchStudentStats(true)}
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

      {!isLoading && data && (
        <div className="space-y-8">
          {/* EJE 1: RENDIMIENTO (RF-9) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <span>📊</span> Eje de Rendimiento Escolar
              </h2>
              <span className="text-xs font-medium text-zinc-500">
                Umbral de aprobación: <strong>{data.performance.passingScore.toFixed(1)}</strong>
              </span>
            </div>

            {/* Performance KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
                <span className="text-xs font-medium text-zinc-500">Promedio del alumno</span>
                <p className="text-3xl font-extrabold text-blue-600 mt-1">
                  {formatScore(data.performance.studentAverageScore)}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Promedio del grupo:{' '}
                  <strong className="text-zinc-700">
                    {formatScore(data.performance.groupAverageScore)}
                  </strong>
                </p>
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
                <span className="text-xs font-medium text-zinc-500">Tasa de aprobación</span>
                <p className="text-3xl font-extrabold text-emerald-600 mt-1">
                  {data.performance.passRatePercent !== null
                    ? `${data.performance.passRatePercent}%`
                    : '—'}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {data.performance.passedCount} aprobadas / {data.performance.totalGradedActivities} calificadas
                </p>
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
                <span className="text-xs font-medium text-zinc-500">Aprobadas vs Por mejorar</span>
                <div className="flex items-center gap-4 mt-2">
                  <div className="text-center">
                    <span className="text-2xl font-bold text-emerald-700">
                      {data.performance.passedCount}
                    </span>
                    <span className="block text-[10px] text-emerald-800 font-medium">Aprobadas</span>
                  </div>
                  <div className="h-8 w-px bg-zinc-200" />
                  <div className="text-center">
                    <span className="text-2xl font-bold text-rose-600">
                      {data.performance.needsImprovementCount}
                    </span>
                    <span className="block text-[10px] text-rose-800 font-medium">Por mejorar</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
                <span className="text-xs font-medium text-zinc-500">Total calificadas en periodo</span>
                <p className="text-3xl font-extrabold text-zinc-900 mt-1">
                  {data.performance.totalGradedActivities}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Incluye serie de microjuegos y último intento de asignaciones
                </p>
              </div>
            </div>

            {/* Score Series Table */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-semibold text-zinc-900">
                Historial cronológico de notas ({data.performance.scoreSeries.length} entregas)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-800">
                  <thead className="bg-zinc-50 text-zinc-700 font-semibold border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-2.5">Actividad</th>
                      <th className="px-3 py-2.5">Tipo</th>
                      <th className="px-3 py-2.5">Mecánica / Detalle</th>
                      <th className="px-3 py-2.5">Nivel</th>
                      <th className="px-3 py-2.5 text-center">Intento</th>
                      <th className="px-4 py-2.5">Calificación</th>
                      <th className="px-3 py-2.5">Estado</th>
                      <th className="px-3 py-2.5">Banderas</th>
                      <th className="px-4 py-2.5">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {data.performance.scoreSeries.map((item) => (
                      <tr key={item.attemptId} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-semibold text-zinc-900">
                          {item.activityTitle}
                        </td>
                        <td className="px-3 py-3 capitalize">{item.activityType.replace('_', ' ')}</td>
                        <td className="px-3 py-3 capitalize">
                          {item.gameMechanic ? item.gameMechanic.replace('_', ' ') : '—'}
                        </td>
                        <td className="px-3 py-3">{item.level}</td>
                        <td className="px-3 py-3 text-center font-medium">#{item.attemptNumber}</td>
                        <td className="px-4 py-3 font-extrabold text-blue-600 text-sm">
                          {item.score.toFixed(1)}
                        </td>
                        <td className="px-3 py-3">
                          {item.passed ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold text-[11px]">
                              Aprobada
                            </span>
                          ) : (
                            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-semibold text-[11px]">
                              Por mejorar
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 space-x-1">
                          {item.usedExtendedDeadline && (
                            <span className="text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] font-medium">
                              Plazo extendido
                            </span>
                          )}
                          {/* guardrails-ignore G-C06: bandera de duracion calculada en servidor, no telemetria de terceros */}
                          {item.implausibleDuration && (
                            <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-medium">
                              Duración atípica
                            </span>
                          )}
                          {/* guardrails-ignore G-C06: bandera de duracion calculada en servidor, no telemetria de terceros */}
                          {!item.usedExtendedDeadline && !item.implausibleDuration && (
                            <span className="text-zinc-400 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {new Date(item.gradedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {data.performance.scoreSeries.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                          No hay entregas calificadas en el periodo seleccionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Breakdowns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* By Activity Type */}
              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Por Tipo de Actividad
                </h4>
                <div className="space-y-2">
                  {data.performance.byActivityType.map((t) => (
                    <div
                      key={t.type}
                      className="flex items-center justify-between text-xs py-1 border-b border-zinc-100 last:border-0"
                    >
                      <span className="capitalize text-zinc-700">
                        {t.type.replace('_', ' ')} ({t.gradedCount})
                      </span>
                      <span className="font-bold text-blue-600">{formatScore(t.averageScore)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Game Mechanic */}
              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Por Mecánica de Juego
                </h4>
                <div className="space-y-2">
                  {data.performance.byGameMechanic.map((m) => (
                    <div
                      key={m.mechanic}
                      className="flex items-center justify-between text-xs py-1 border-b border-zinc-100 last:border-0"
                    >
                      <span className="capitalize text-zinc-700">
                        {m.mechanic.replace('_', ' ')} ({m.attemptsCount})
                      </span>
                      <span className="font-bold text-blue-600">{formatScore(m.averageScore)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Level */}
              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs space-y-3">
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Por Nivel MCER
                </h4>
                <div className="space-y-2">
                  {data.performance.byLevel.map((l) => (
                    <div
                      key={l.level}
                      className="flex items-center justify-between text-xs py-1 border-b border-zinc-100 last:border-0"
                    >
                      <span className="font-semibold text-zinc-700">
                        Nivel {l.level} ({l.gradedCount})
                      </span>
                      <span className="font-bold text-blue-600">{formatScore(l.averageScore)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* EJE 2: CONSTANCIA (RF-10) */}
          <div className="space-y-4 pt-4 border-t border-zinc-200">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <span>🔥</span> Eje de Constancia y Hábito de Estudio
            </h2>

            {/* Consistency KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
                <span className="text-xs font-medium text-zinc-500">Racha vigente</span>
                <p className="text-3xl font-extrabold text-orange-600 mt-1">
                  {data.consistency.currentStreakWeeks} semanas
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Mejor histórica:{' '}
                  <strong className="text-zinc-800">
                    {data.consistency.bestStreakWeeks} semanas
                  </strong>
                </p>
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
                <span className="text-xs font-medium text-zinc-500">Perdón de racha</span>
                <p
                  className={`text-xl font-bold mt-2 ${
                    data.consistency.forgivenessAvailable ? 'text-emerald-700' : 'text-zinc-500'
                  }`}
                >
                  {data.consistency.forgivenessAvailable ? 'Disponible 🛡️' : 'Consumido'}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Se recupera tras 2 semanas consecutivas activas
                </p>
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
                <span className="text-xs font-medium text-zinc-500">Cumplimiento asignaciones</span>
                <p className="text-3xl font-extrabold text-blue-600 mt-1">
                  {data.consistency.completionRatePercent !== null
                    ? `${data.consistency.completionRatePercent}%`
                    : '—'}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {data.consistency.completedAssignedCount} de {data.consistency.assignedCount} asignaciones obligatorias
                </p>
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
                <span className="text-xs font-medium text-zinc-500">Tiempo total dedicado</span>
                <p className="text-3xl font-extrabold text-zinc-900 mt-1">
                  {formatDuration(data.consistency.totalTimeSpentSeconds)}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {data.consistency.completedActivitiesInPeriod} entregas completadas en periodo
                </p>
              </div>
            </div>

            {/* Weekly Calendar (12 ISO Weeks) */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Calendario de constancia semanal (últimas 12 semanas ISO)
                </h3>
                <span className="text-xs text-zinc-500">Evaluado en zona horaria America/Bogota</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {data.consistency.weeklyCalendar.map((wk) => (
                  <div
                    key={wk.weekKey}
                    className="border border-zinc-200 rounded-lg p-3 bg-zinc-50/50 flex flex-col justify-between space-y-2"
                  >
                    <div>
                      <span className="text-xs font-bold text-zinc-800">{wk.weekKey}</span>
                      <span className="block text-[10px] text-zinc-500">Desde: {wk.weekStart}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-700">
                        {wk.completedCount} entregas
                      </span>
                      <WeekStatusBadge status={wk.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Time Spent Breakdown Tabs */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Desglose de tiempo de estudio
                </h3>
                <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setTimeBucketMode('daily')}
                    className={`rounded-md px-3 py-1 transition-colors ${
                      timeBucketMode === 'daily'
                        ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Por Día
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeBucketMode('weekly')}
                    className={`rounded-md px-3 py-1 transition-colors ${
                      timeBucketMode === 'weekly'
                        ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Por Semana
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeBucketMode('monthly')}
                    className={`rounded-md px-3 py-1 transition-colors ${
                      timeBucketMode === 'monthly'
                        ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Por Mes
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-800">
                  <thead className="bg-zinc-50 text-zinc-700 font-semibold border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-2.5">Periodo</th>
                      <th className="px-4 py-2.5">Tiempo total dedicado</th>
                      <th className="px-4 py-2.5">Actividades completadas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(timeBucketMode === 'daily'
                      ? data.consistency.dailyTime
                      : timeBucketMode === 'weekly'
                        ? data.consistency.weeklyTime
                        : data.consistency.monthlyTime
                    ).map((item) => (
                      <tr key={item.bucketKey} className="hover:bg-zinc-50">
                        <td className="px-4 py-2.5 font-bold text-zinc-900">{item.bucketKey}</td>
                        <td className="px-4 py-2.5 font-semibold text-blue-600">
                          {formatDuration(item.timeSpentSeconds)}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-700">{item.completedCount}</td>
                      </tr>
                    ))}
                    {(timeBucketMode === 'daily'
                      ? data.consistency.dailyTime
                      : timeBucketMode === 'weekly'
                        ? data.consistency.weeklyTime
                        : data.consistency.monthlyTime
                    ).length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-zinc-500">
                          No hay registros de tiempo para el rango seleccionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = use(params);

  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-zinc-500 text-sm">
          Cargando ficha del estudiante…
        </div>
      }
    >
      <StudentDetailContent studentId={unwrappedParams.id} />
    </Suspense>
  );
}
