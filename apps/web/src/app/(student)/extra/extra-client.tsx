'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ExternalResourceItem,
  ExternalResourceListResponse,
  StudentProfileView,
  isValidHttpsResourceUrl,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../lib/api';

interface FeatureFlagsResponse {
  flags: {
    games: boolean;
    extra_content: boolean;
  };
}

export function ExtraClient() {
  // Offline detection (T-05, RF-8)
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') return navigator.onLine;
    return true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Speech synthesis state (kids TTS, RF-9)
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [hasSpeechSupport, setHasSpeechSupport] = useState<boolean>(false);

  useEffect(() => {
    setHasSpeechSupport(typeof window !== 'undefined' && 'speechSynthesis' in window);
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSpeak = (item: ExternalResourceItem) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speakingId === item.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const textToSpeak = item.description ? `${item.title}. ${item.description}` : item.title;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'es-CO';

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(item.id);
    window.speechSynthesis.speak(utterance);
  };

  // Queries
  const flagsQuery = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => apiFetch<FeatureFlagsResponse>('/api/v1/feature-flags'),
  });

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<StudentProfileView>('/api/v1/me'),
  });

  const isExtraContentEnabled = Boolean(flagsQuery.data?.flags?.extra_content);

  const resourcesQuery = useQuery({
    queryKey: ['resources'],
    queryFn: () => apiFetch<ExternalResourceListResponse>('/api/v1/resources'),
    enabled: isExtraContentEnabled,
  });

  // Level & Theme detection
  const ageSegment = meQuery.data?.student?.ageSegment ?? 'kids';
  const isKids = ageSegment === 'kids';
  const studentLevel = meQuery.data?.student?.level ?? null;

  // Local filter pill state
  const [filterPill, setFilterPill] = useState<'todos' | 'nivel' | 'generales'>('todos');

  const filteredItems = useMemo(() => {
    const all = resourcesQuery.data?.items ?? [];
    if (filterPill === 'generales') {
      return all.filter((item) => item.level === null);
    }
    if (filterPill === 'nivel' && studentLevel) {
      return all.filter((item) => item.level === studentLevel);
    }
    return all;
  }, [resourcesQuery.data?.items, filterPill, studentLevel]);

  const getHostname = (rawUrl: string): string => {
    try {
      return new URL(rawUrl).hostname;
    } catch {
      return 'enlace externo';
    }
  };

  // 1. Loading state
  if (flagsQuery.isLoading || (isExtraContentEnabled && resourcesQuery.isLoading)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
        <div
          className={`inline-block h-10 w-10 animate-spin rounded-full border-4 border-t-transparent ${
            isKids ? 'border-amber-500' : 'border-indigo-500'
          }`}
        />
        <p className={`text-sm font-bold ${isKids ? 'text-amber-900' : 'text-zinc-300'}`}>
          Cargando contenido extra…
        </p>
      </div>
    );
  }

  // 2. Feature flag disabled or 403 response (RF-3, RF-5)
  const isForbiddenError =
    resourcesQuery.error instanceof ApiError &&
    (resourcesQuery.error.code === 'EXTRA_CONTENT_DISABLED' ||
      resourcesQuery.error.statusCode === 403);

  if (!isExtraContentEnabled || isForbiddenError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-6">
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-3xl text-4xl shadow-xs ${
            isKids ? 'bg-amber-100 text-amber-900' : 'bg-zinc-800 text-zinc-200'
          }`}
          aria-hidden="true"
        >
          🔗
        </div>
        <div className="space-y-2">
          <h1
            className={`text-2xl font-extrabold tracking-tight ${
              isKids ? 'text-amber-950' : 'text-zinc-100'
            }`}
          >
            Contenido extra no disponible
          </h1>
          <p
            className={`text-sm max-w-md mx-auto leading-relaxed ${
              isKids ? 'text-amber-800' : 'text-zinc-400'
            }`}
          >
            El contenido extra no está habilitado en este momento.
          </p>
        </div>
        <div>
          <Link
            href="/inicio"
            className={`inline-flex items-center justify-center min-h-[48px] min-w-[48px] px-6 py-2.5 rounded-2xl text-sm font-bold shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 ${
              isKids
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Offline banner (RF-8, T-05) */}
      {!isOnline && (
        <div
          role="status"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 flex items-center gap-3 shadow-xs"
        >
          <span className="text-2xl" aria-hidden="true">📡</span>
          <p className="text-xs sm:text-sm font-semibold">
            Necesitas conexión a internet para abrir enlaces externos.
          </p>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🔗</span>
            <h1
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                isKids ? 'text-amber-950' : 'text-zinc-100'
              }`}
            >
              Contenido extra
            </h1>
          </div>
          <p
            className={`text-sm mt-1 leading-relaxed ${
              isKids ? 'text-amber-950 font-medium' : 'text-zinc-200'
            }`}
          >
            {isKids
              ? 'Explora juegos, videos y lecturas complementarias para aprender divirtiéndote.'
              : 'Recursos educativos y herramientas complementarias para profundizar en tu nivel de inglés.'}
          </p>
        </div>

        {/* Level badge */}
        {studentLevel && (
          <span
            className={`inline-flex items-center self-start sm:self-center px-3 py-1 rounded-full text-xs font-bold ${
              isKids
                ? 'bg-amber-200 text-amber-950'
                : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
            }`}
          >
            Tu nivel: {studentLevel}
          </span>
        )}
      </div>

      {/* Pill Filter Toolbar (RF-5) */}
      <div
        className="flex flex-wrap items-center gap-2"
        role="toolbar"
        aria-label="Filtrar contenido por nivel"
      >
        <button
          type="button"
          onClick={() => setFilterPill('todos')}
          aria-pressed={filterPill === 'todos'}
          className={`inline-flex items-center justify-center min-h-[48px] min-w-[48px] px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 ${
            filterPill === 'todos'
              ? isKids
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-indigo-600 text-white shadow-xs'
              : isKids
                ? 'bg-amber-100/70 text-amber-900 hover:bg-amber-200'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          Todos
        </button>

        {studentLevel && (
          <button
            type="button"
            onClick={() => setFilterPill('nivel')}
            aria-pressed={filterPill === 'nivel'}
            className={`inline-flex items-center justify-center min-h-[48px] min-w-[48px] px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 ${
              filterPill === 'nivel'
                ? isKids
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-indigo-600 text-white shadow-xs'
                : isKids
                  ? 'bg-amber-100/70 text-amber-900 hover:bg-amber-200'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            Nivel {studentLevel}
          </button>
        )}

        <button
          type="button"
          onClick={() => setFilterPill('generales')}
          aria-pressed={filterPill === 'generales'}
          className={`inline-flex items-center justify-center min-h-[48px] min-w-[48px] px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 ${
            filterPill === 'generales'
              ? isKids
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-indigo-600 text-white shadow-xs'
              : isKids
                ? 'bg-amber-100/70 text-amber-900 hover:bg-amber-200'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          Generales
        </button>
      </div>

      {/* Empty State (RF-5) */}
      {filteredItems.length === 0 ? (
        <div
          className={`rounded-3xl border p-12 text-center space-y-4 ${
            isKids
              ? 'border-amber-200 bg-amber-50/60 text-amber-950'
              : 'border-zinc-800 bg-zinc-900/60 text-zinc-200'
          }`}
        >
          <div className="text-4xl" aria-hidden="true">
            🌟
          </div>
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold">
              {isKids
                ? 'Todavía no hay enlaces extra para explorar.'
                : 'Aún no hay contenido extra publicado para tu nivel.'}
            </h2>
            <p
              className={`text-xs sm:text-sm max-w-sm mx-auto ${
                isKids ? 'text-amber-950 font-medium' : 'text-zinc-300'
              }`}
            >
              La profesora añadirá nuevos enlaces recomendados pronto.
            </p>
          </div>
          <div>
            <Link
              href="/inicio"
              className={`inline-flex items-center justify-center min-h-[48px] min-w-[48px] px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 ${
                isKids
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      ) : (
        /* Resource Cards (RF-5, RF-6, RF-9) */
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Tarjetas de contenido extra">
          {filteredItems.map((item) => {
            const domain = getHostname(item.url);
            const isSpeakingThis = speakingId === item.id;

            return (
              <li
                key={item.id}
                className={`flex flex-col justify-between rounded-3xl border p-5 shadow-xs transition-all ${
                  isKids
                    ? 'border-amber-200 bg-white hover:border-amber-300'
                    : 'border-zinc-800 bg-zinc-900/90 hover:border-zinc-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        item.level
                          ? isKids
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          : isKids
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {item.level ? `Nivel ${item.level}` : 'General'}
                    </span>

                    <span
                      className={`text-xs font-semibold truncate max-w-[150px] ${
                        isKids ? 'text-amber-950 font-medium' : 'text-zinc-300'
                      }`}
                    >
                      {domain}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h2
                      className={`text-base sm:text-lg font-bold leading-snug ${
                        isKids ? 'text-amber-950' : 'text-zinc-100'
                      }`}
                    >
                      {item.title}
                    </h2>
                    {item.description && (
                      <p
                        className={`text-xs sm:text-sm leading-relaxed ${
                          isKids ? 'text-amber-950 font-medium' : 'text-zinc-200'
                        }`}
                      >
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions: TTS in Kids and Open External in New Tab */}
                <div className="flex items-center justify-between gap-3 pt-4 border-t mt-4 border-zinc-100 dark:border-zinc-800">
                  {isKids && hasSpeechSupport ? (
                    <button
                      type="button"
                      onClick={() => handleSpeak(item)}
                      aria-label={
                        isSpeakingThis
                          ? `Detener locución de ${item.title}`
                          : `Escuchar descripción de ${item.title}`
                      }
                      className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] px-3.5 py-2 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
                    >
                      {isSpeakingThis ? '⏹ Detener' : '🔊 Escuchar'}
                    </button>
                  ) : (
                    <div />
                  )}

                  {isValidHttpsResourceUrl(item.url) ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center justify-center min-h-[48px] min-w-[48px] px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 ${
                        isKids
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      Abrir en pestaña nueva ↗
                    </a>
                  ) : (
                    <span className="text-xs text-zinc-400 italic">Enlace no seguro o inválido</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
