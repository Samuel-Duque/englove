'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ActivityType,
  AttemptStatus,
  RuntimeView,
  CompletionView,
  FillBlankConfig,
  ExamConfig,
  GamePublicConfig,
  GameAnswers,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../../lib/api';
import { GameRenderer } from '../../../../components/activities/GameRenderer';
import { fireCelebrationConfetti } from '../../../../lib/confetti';
import { uploadAudioBlob } from '../../../../lib/audio-upload';
import { renderBadgeIcon } from '../../../../lib/badges';
import { setActiveAttemptState } from '../../../../lib/pwa-manager';
import { enqueueEvent, enqueueUpload } from '../../../../lib/offline-queue';
import { OfflineStatusBanner } from '../../../../components/offline-status-banner';

interface ActividadRunnerProps {
  attemptId: string;
}

export function ActividadRunner({ attemptId }: ActividadRunnerProps) {
  const router = useRouter();

  const [runtime, setRuntime] = useState<RuntimeView | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completion, setCompletion] = useState<CompletionView | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [theme, setTheme] = useState<'kids' | 'teens'>('kids');
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('std-local');
  const [hasTtsSupport, setHasTtsSupport] = useState(false);

  // Check TTS support (RF-22)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const checkVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setHasTtsSupport(voices.length > 0 || !('onvoiceschanged' in window.speechSynthesis));
      };
      checkVoices();
      if ('onvoiceschanged' in window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = checkVoices;
      }
    }
  }, []);

  // Speaking state
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingEventsRef = useRef<Set<Promise<unknown>>>(new Set());

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // MIME detection in preference order (architecture §3.5)
  const getSupportedMimeType = (): string => {
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return 'audio/webm';
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  };

  // IndexedDB persistence for offline recovery and failure retry (RF-11, RF-28, §7)
  const saveLocalRecording = (id: string, blob: Blob): Promise<void> => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        const req = window.indexedDB.open('englove_storage', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('pendingUploads')) {
            db.createObjectStore('pendingUploads', { keyPath: 'attemptId' });
          }
        };
        req.onsuccess = () => {
          try {
            const db = req.result;
            if (!db.objectStoreNames.contains('pendingUploads')) {
              db.close();
              return resolve();
            }
            const tx = db.transaction('pendingUploads', 'readwrite');
            tx.objectStore('pendingUploads').put({ attemptId: id, blob, savedAt: Date.now() });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); resolve(); };
          } catch {
            resolve();
          }
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  };

  const loadLocalRecording = (id: string): Promise<Blob | null> => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const req = window.indexedDB.open('englove_storage', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('pendingUploads')) {
            db.createObjectStore('pendingUploads', { keyPath: 'attemptId' });
          }
        };
        req.onsuccess = () => {
          try {
            const db = req.result;
            if (!db.objectStoreNames.contains('pendingUploads')) {
              db.close();
              return resolve(null);
            }
            const tx = db.transaction('pendingUploads', 'readonly');
            const getReq = tx.objectStore('pendingUploads').get(id);
            getReq.onsuccess = () => {
              db.close();
              if (getReq.result && getReq.result.blob instanceof Blob) {
                resolve(getReq.result.blob);
              } else {
                resolve(null);
              }
            };
            getReq.onerror = () => { db.close(); resolve(null); };
          } catch {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  };

  const clearLocalRecording = (id: string): Promise<void> => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        const req = window.indexedDB.open('englove_storage', 1);
        req.onsuccess = () => {
          try {
            const db = req.result;
            if (db.objectStoreNames.contains('pendingUploads')) {
              const tx = db.transaction('pendingUploads', 'readwrite');
              tx.objectStore('pendingUploads').delete(id);
              tx.oncomplete = () => { db.close(); resolve(); };
              tx.onerror = () => { db.close(); resolve(); };
            } else {
              db.close();
              resolve();
            }
          } catch {
            resolve();
          }
        };
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  };

  // Load Attempt Runtime
  useEffect(() => {
    let isMounted = true;
    async function loadAttempt() {
      setIsLoading(true);
      setError(null);
      try {
        const [data, profile] = await Promise.all([
          apiFetch<RuntimeView>(`/api/v1/attempts/${attemptId}`),
          apiFetch<{ user?: { id?: string }; student?: { ageSegment?: 'kids' | 'teens' } }>('/api/v1/me').catch(() => null),
        ]);
        if (isMounted) {
          if (profile?.user?.id) {
            setCurrentUserId(profile.user.id);
          }
          const ageSegment = profile?.student?.ageSegment ?? 'kids';
          setTheme(ageSegment);
          setSoundEnabled(ageSegment === 'kids'); // soundEnabled starts true for kids, false for teens (RF-9)
          setRuntime(data);
          setAnswers(data.answers || {});
          if (data.mediaId) setMediaId(data.mediaId);
          if (data.attempt.status === AttemptStatus.in_progress) {
            setActiveAttemptState(true); // RF-9: defer update notices during active attempt
          }
          if (
            data.attempt.status === AttemptStatus.graded ||
            data.attempt.status === AttemptStatus.pending_review
          ) {
            setActiveAttemptState(false);
            setCompletion({
              attempt: data.attempt,
              correction: data.correction,
              newBadges: [],
            });
          }
        }

        // Restore pending local audio blob if any
        const savedBlob = await loadLocalRecording(attemptId);
        if (savedBlob && isMounted && !data.mediaId) {
          setRecordedAudioBlob(savedBlob);
        }
      } catch (err) {
        if (isMounted) {
          if (err instanceof ApiError) setError(err.message);
          else setError('No se pudo cargar la actividad');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadAttempt();
    return () => {
      isMounted = false;
      setActiveAttemptState(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [attemptId]);

  // Persistent event emitter (RF-10, Decision 37)
  const sendEvent = useCallback(
    (itemId: string, answer: unknown): Promise<void> => {
      if (!runtime?.attemptToken) return Promise.resolve();
      const attemptToken = runtime.attemptToken;
      const clientEventId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `evt-${Date.now()}-${Math.random()}`;

      // 1. Guardar primero en IndexedDB (RF-10) y vaciar con la cola automática (RF-11); at/createdAt nunca viaja a la API (Decisión 37)
      const promise = enqueueEvent({
        userId: currentUserId,
        attemptId,
        clientEventId,
        eventType: 'answered',
        payload: { itemId, answer },
        attemptToken,
      }).then(() => {});

      pendingEventsRef.current.add(promise);
      promise.finally(() => {
        pendingEventsRef.current.delete(promise);
      });
      return promise;
    },
    [attemptId, runtime?.attemptToken, currentUserId],
  );

  const handleAnswerChange = (itemId: string, value: unknown) => {
    setAnswers((prev) => {
      const updated = { ...prev, [itemId]: value };
      return updated;
    });
    sendEvent(itemId, value);
  };

  // Text-To-Speech for Kids prompts (RF-22)
  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      // Spanish vs English detection (RF-22)
      const isSpanish = /[áéíóúñ¿¡]|(\b(selecciona|completa|escucha|arrastra|responde|elige|traduce|escribe|une|haz|marca|graba|instrucción|pregunta|oración)\b)/i.test(text);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = isSpanish ? 'es-CO' : 'en-US';
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Audio Recording (Speaking)
  const startRecording = async () => {
    try {
      setUploadError(null);
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = getSupportedMimeType();
      const mediaRecorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || preferredMime || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedAudioBlob(audioBlob);
        saveLocalRecording(attemptId, audioBlob);

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 120) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      alert('Por favor habilita el permiso de micrófono en tu navegador para grabar.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  const uploadAudioRecording = async (): Promise<string | null> => {
    if (!recordedAudioBlob) return mediaId;
    if (recordingSeconds > 0 && recordingSeconds < 2) {
      alert('Graba al menos 2 segundos');
      return null;
    }

    setIsUploadingAudio(true);
    setUploadError(null);
    setUploadProgress('Obteniendo enlace de subida seguro…');
    try {
      // URL firmada + PUT a R2; devuelve el mediaId del contrato (ENG-074)
      const uploadedMediaId = await uploadAudioBlob({
        apiUrl,
        origin: window.location.origin,
        attemptId,
        blob: recordedAudioBlob,
      });

      setMediaId(uploadedMediaId);
      setUploadProgress(null);
      setUploadError(null);
      return uploadedMediaId;
    } catch {
      setUploadProgress(null);
      setUploadError('No pudimos enviar tu grabación. Sigue guardada en este dispositivo');
      return null;
    } finally {
      setIsUploadingAudio(false);
    }
  };

  // Submit attempt completion
  const handleCompleteAttempt = async (overrideAnswers?: Record<string, unknown>) => {
    if (!runtime?.attemptToken) {
      alert('Token de intento no disponible');
      return;
    }
    const attemptToken = runtime.attemptToken;

    if (overrideAnswers) {
      setAnswers((prev) => ({ ...prev, ...overrideAnswers }));
      for (const [itemId, value] of Object.entries(overrideAnswers)) {
        void sendEvent(itemId, value);
      }
    }

    setIsSubmitting(true);
    let finalMediaId: string | null = mediaId;
    try {
      if (pendingEventsRef.current.size > 0) {
        await Promise.allSettled(Array.from(pendingEventsRef.current));
      }

      if (runtime.activity.type === ActivityType.speaking) {
        if (!recordedAudioBlob && !mediaId) {
          alert('Debes grabar un audio antes de entregar la actividad.');
          setIsSubmitting(false);
          return;
        }
        if (recordedAudioBlob && !mediaId) {
          const isCurrentlyOffline = typeof navigator !== 'undefined' && !navigator.onLine;
          if (isCurrentlyOffline) {
            throw new TypeError('Network request failed');
          }
          finalMediaId = await uploadAudioRecording();
          if (!finalMediaId) {
            const isOfflineNow =
              (typeof navigator !== 'undefined' && !navigator.onLine) ||
              Boolean(uploadError);
            if (isOfflineNow) {
              throw new TypeError('Network request failed');
            }
            setIsSubmitting(false);
            return;
          }
        }
      }

      const res = await fetch(`${apiUrl}/api/v1/attempts/${attemptId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-attempt-token': attemptToken,
          Origin: window.location.origin,
        },
        credentials: 'include',
        body: JSON.stringify({
          ...(finalMediaId ? { mediaId: finalMediaId } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al entregar la actividad');
      }

      const compData: CompletionView = await res.json();
      setCompletion(compData);
      setActiveAttemptState(false);

      // Trigger celebration confetti when student scores >= 3.0 (RF-9, ENG-086)
      if (compData.attempt.score !== null && compData.attempt.score !== undefined && compData.attempt.score >= 3.0) {
        fireCelebrationConfetti({ theme });
      }

      // Clean local storage upon confirmed completion (RF-13, RF-28)
      await clearLocalRecording(attemptId);
    } catch (err: unknown) {
      const isNetworkError =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        err instanceof TypeError ||
        Boolean((err as Error)?.message && /network|fetch|offline|failed to fetch/i.test((err as Error).message));

      if (isNetworkError) {
        // RF-12: Entrega sin conexión. Queda en la cola y muestra mensaje sin nota ficticia.
        const compEventId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `evt-comp-${Date.now()}`;
        await enqueueEvent({
          userId: currentUserId,
          attemptId,
          clientEventId: compEventId,
          eventType: 'completed',
          payload: { ...(finalMediaId ? { mediaId: finalMediaId } : mediaId ? { mediaId } : {}) },
          attemptToken,
        });

        if (recordedAudioBlob) {
          await enqueueUpload({
            userId: currentUserId,
            attemptId,
            blob: recordedAudioBlob,
            mimeType: recordedAudioBlob.type || 'audio/webm',
            durationMs: recordingSeconds * 1000,
            mediaId: finalMediaId || mediaId || null,
            attemptToken,
          });
        }

        setIsOfflineSaved(true);
        setActiveAttemptState(false);
      } else {
        alert((err as Error)?.message || 'No se pudo completar la entrega');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Play again for microgames (Decision 104, RF-4)
  const handlePlayAgain = async () => {
    if (!runtime?.attempt?.assignmentId) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch<RuntimeView>(
        `/api/v1/assignments/${runtime.attempt.assignmentId}/attempts`,
        {
          method: 'POST',
        },
      );
      router.push(`/actividad/${res.attempt.id}`);
      router.refresh();
    } catch (err: unknown) {
      alert((err as Error)?.message || 'No se pudo iniciar un nuevo intento del juego');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="mt-3 text-sm font-semibold opacity-70">Cargando actividad…</p>
      </div>
    );
  }

  if (error || !runtime) {
    return (
      <div className="py-12 max-w-lg mx-auto text-center bg-white p-8 rounded-2xl border border-rose-200 shadow-sm">
        <span className="text-4xl">⚠️</span>
        <h2 className="text-lg font-bold text-rose-900 mt-3">No pudimos abrir la actividad</h2>
        <p className="text-sm text-rose-700 mt-1">{error || 'Intento no disponible'}</p>
        <Link
          href="/inicio"
          className="mt-6 inline-block rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-amber-600"
        >
          Volver al Inicio
        </Link>
      </div>
    );
  }

  const { activity, attempt } = runtime;
  const isFinished =
    completion !== null ||
    isOfflineSaved ||
    attempt.status === AttemptStatus.graded ||
    attempt.status === AttemptStatus.pending_review;

  // Render Offline Delivery Receipt (RF-12, §7)
  if (isOfflineSaved) {
    const isKids = theme === 'kids';
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="rounded-3xl border border-amber-200 bg-white p-8 sm:p-10 text-center shadow-lg">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-100 text-4xl shadow-inner mb-4">
            💾
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-amber-950 mb-3">
            {isKids
              ? '¡Listo! Tu trabajo quedó guardado y se enviará solo cuando vuelva el internet.'
              : 'Guardado en este dispositivo. Se enviará cuando vuelva la conexión.'}
          </h2>
          <p className="text-sm text-zinc-600 max-w-md mx-auto mb-8">
            {isKids
              ? 'No te preocupes por tu progreso: tus respuestas están seguras en esta tablet.'
              : 'Las respuestas se sincronizarán automáticamente con el servidor al restablecerse la red.'}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href="/inicio"
              className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-6 py-3 text-base shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
            >
              Ir a Mis Misiones
            </Link>
            <Link
              href="/progreso"
              className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-2xl border border-amber-300 bg-amber-100/60 hover:bg-amber-100 text-amber-950 font-bold px-6 py-3 text-base transition-all focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
            >
              Ver Mi Progreso
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Render Completion Modal/Card
  if (completion) {
    const score = completion.attempt.score;
    let starsCount = 0;
    if (score !== null && score !== undefined) {
      if (score >= 4.5) starsCount = 3;
      else if (score >= 3.0) starsCount = 2;
      else if (score > 0) starsCount = 1;
    }

    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="rounded-3xl border border-amber-200 bg-white p-8 sm:p-10 text-center shadow-lg">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-100 text-4xl shadow-inner mb-4">
            {activity.type === ActivityType.open_question || activity.type === ActivityType.speaking
              ? '📝'
              : starsCount >= 2
                ? '🏆'
                : '⭐'}
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-amber-950">
            {activity.type === ActivityType.open_question || activity.type === ActivityType.speaking
              ? '¡Actividad entregada con éxito!'
              : '¡Misión completada!'}
          </h2>

          {score !== null && score !== undefined ? (
            <div className="mt-4">
              <div className="flex justify-center gap-1.5 text-3xl my-2">
                {[1, 2, 3].map((starIdx) => (
                  <span
                    key={starIdx}
                    className={starIdx <= starsCount ? 'text-amber-400 drop-shadow-sm' : 'text-zinc-200'}
                  >
                    ★
                  </span>
                ))}
              </div>
              <p className="text-2xl font-extrabold text-amber-900 mt-1">
                Nota: {score.toFixed(1)} / 5.0
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-600 max-w-md mx-auto">
              Tu respuesta ha quedado registrada. Tu profesora la revisará y calificará en los próximos días.
            </p>
          )}

          {/* New Badges Awarded */}
          {completion.newBadges && completion.newBadges.length > 0 && (
            <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2">
                ¡Nueva insignia desbloqueada! 🎉
              </p>
              {completion.newBadges.map((b) => (
                <div key={b.id} className="flex items-center gap-3">
                  <span className="text-3xl">{renderBadgeIcon(b.icon)}</span>
                  <div>
                    <h4 className="text-sm font-extrabold text-amber-950">{b.name}</h4>
                    <p className="text-xs text-amber-800">{b.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            {activity.type === ActivityType.game && runtime?.attempt?.assignmentId && (
              <button
                type="button"
                onClick={handlePlayAgain}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-2xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-extrabold px-6 py-3 text-base shadow-sm transition-all disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
              >
                🎮 {isSubmitting ? 'Iniciando…' : 'Jugar de nuevo'}
              </button>
            )}
            <Link
              href="/inicio"
              className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-2xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-extrabold px-6 py-3 text-base shadow-sm transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
            >
              Ir a Mis Misiones
            </Link>
            <Link
              href="/progreso"
              className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-2xl border border-amber-300 bg-amber-100/60 hover:bg-amber-100 text-amber-950 font-bold px-6 py-3 text-base transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
            >
              Ver Mi Progreso
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Activity Configuration Rendering
  const fbConfig = activity.config as FillBlankConfig;
  const examConfig = activity.config as ExamConfig;
  const speakingConfig = activity.config as {
    prompt?: string;
    exampleUrl?: string | null;
    minDurationSeconds?: number;
    maxDurationSeconds?: number;
  };
  const openQConfig = activity.config as { prompt?: string };

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <OfflineStatusBanner />

      {/* Activity Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800">
              Nivel {activity.level}
            </span>
            <span className="text-xs font-semibold text-zinc-500">
              Intento #{attempt.attemptNumber}
            </span>
            {attempt.status === 'in_progress' && attempt.completeUntil && (
              <span className="text-xs font-bold text-amber-900 bg-amber-100/90 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span>⏳</span>
                <span>
                  Termina antes de:{' '}
                  {new Date(attempt.completeUntil).toLocaleDateString('es-CO', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </span>
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-950">{activity.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          {activity.type === ActivityType.game && (
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
              title={soundEnabled ? 'Silenciar efectos de sonido' : 'Activar efectos de sonido'}
              aria-label={soundEnabled ? 'Silenciar efectos de sonido' : 'Activar efectos de sonido'}
            >
              <span>{soundEnabled ? '🔊' : '🔇'}</span>
              <span>{soundEnabled ? 'Sonido sí' : 'Sonido no'}</span>
            </button>
          )}

          {hasTtsSupport && (
            <button
              type="button"
              onClick={() => speakText(activity.title)}
              className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
              title="Escuchar título"
              aria-label="Escuchar título"
            >
              <span>🗣️</span>
              <span>Escuchar</span>
            </button>
          )}
        </div>
      </div>

      {/* Runner Body by Activity Type */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-amber-200/80 shadow-sm space-y-6">
        {/* Fill in the Blank Type */}
        {activity.type === ActivityType.fill_blank && fbConfig?.items && (
          <div className="space-y-6">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Completa los espacios en blanco con la palabra correcta:
            </p>
            {fbConfig.items.map((item, itemIdx) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200/60 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-800">Pregunta {itemIdx + 1}</span>
                  {hasTtsSupport && (
                    <button
                      type="button"
                      onClick={() => speakText(item.prompt)}
                      className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] text-xs font-bold text-amber-700 hover:text-amber-900 gap-1 rounded-xl px-2.5 py-1.5 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 cursor-pointer"
                      aria-label={`Escuchar pregunta ${itemIdx + 1}`}
                    >
                      <span aria-hidden="true">🔊</span> Escuchar
                    </button>
                  )}
                </div>
                <p className="text-base sm:text-lg font-medium text-amber-950 leading-relaxed">
                  {item.prompt}
                </p>

                {/* Blank inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {item.blanks.map((blank, blankIdx) => {
                    const itemAnswers = (answers[item.id] as Record<string, string>) || {};
                    const currentVal = itemAnswers[blank.id] || (answers[blank.id] as string) || '';
                    const blankInputId = `blank-${item.id}-${blank.id || blankIdx}`;
                    const blankLabel = `Espacio ${blankIdx + 1}`;
                    return (
                      <div key={blank.id || String(Math.random())} className="space-y-1">
                        <label htmlFor={blankInputId} className="text-xs font-bold text-zinc-600 block">
                          Espacio [{blank?.id ? (blank.id.length >= 8 ? blank.id.substring(0, 8) : blank.id) : `${blankIdx + 1}`}]:
                        </label>
                        {blank.options && blank.options.length > 0 ? (
                          <select
                            id={blankInputId}
                            aria-label={blankLabel}
                            disabled={isFinished}
                            value={currentVal}
                            onChange={(e) => {
                              const updatedItem = { ...itemAnswers, [blank.id]: e.target.value };
                              handleAnswerChange(item.id, updatedItem);
                            }}
                            className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px]"
                          >
                            <option value="">-- Elige una opción --</option>
                            {blank.options.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.text}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={blankInputId}
                            aria-label={blankLabel}
                            type="text"
                            disabled={isFinished}
                            value={currentVal}
                            onChange={(e) => {
                              const updatedItem = { ...itemAnswers, [blank.id]: e.target.value };
                              handleAnswerChange(item.id, updatedItem);
                            }}
                            placeholder="Escribe tu respuesta…"
                            className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px]"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Exam Type */}
        {activity.type === ActivityType.exam && examConfig?.items && (
          <div className="space-y-6">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Examen — Responde cada una de las oraciones:
            </p>
            {examConfig.items.map((item, itemIdx) => {
              const itemAnswers = (answers[item.id] as Record<string, string>) || {};
              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200/60 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-800">
                      Ítem #{itemIdx + 1} (Peso: {item.weight})
                    </span>
                    {hasTtsSupport && (
                      <button
                        type="button"
                        onClick={() => speakText(item.prompt)}
                        className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] text-xs font-bold text-amber-700 hover:text-amber-900 gap-1 rounded-xl px-2.5 py-1.5 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 cursor-pointer"
                        aria-label={`Escuchar ítem ${itemIdx + 1}`}
                      >
                        <span aria-hidden="true">🔊</span> Escuchar
                      </button>
                    )}
                  </div>
                  <p className="text-base sm:text-lg font-medium text-amber-950 leading-relaxed">
                    {item.prompt}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {item.blanks.map((b, bIdx) => {
                      const examInputId = `exam-blank-${item.id}-${b.id || bIdx}`;
                      const examLabel = `Espacio ${bIdx + 1} del ítem ${itemIdx + 1}`;
                      return (
                        <div key={b.id || String(Math.random())} className="space-y-1">
                          <label htmlFor={examInputId} className="text-xs font-bold text-zinc-600 block">
                            Espacio [{b?.id ? (b.id.length >= 8 ? b.id.substring(0, 8) : b.id) : `${bIdx + 1}`}]:
                          </label>
                          {b.options && b.options.length > 0 ? (
                            <select
                              id={examInputId}
                              aria-label={examLabel}
                              disabled={isFinished}
                              value={itemAnswers[b.id] || ''}
                              onChange={(e) => {
                                const updatedItem = { ...itemAnswers, [b.id]: e.target.value };
                                handleAnswerChange(item.id, updatedItem);
                              }}
                              className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px]"
                            >
                              <option value="">-- Elige una opción --</option>
                              {b.options.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.text}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              id={examInputId}
                              aria-label={examLabel}
                              type="text"
                              disabled={isFinished}
                              value={itemAnswers[b.id] || ''}
                              onChange={(e) => {
                                const updatedItem = { ...itemAnswers, [b.id]: e.target.value };
                                handleAnswerChange(item.id, updatedItem);
                              }}
                              placeholder="Tu respuesta…"
                              className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px]"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Open Question Type */}
        {activity.type === ActivityType.open_question && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-1">
                  Pregunta abierta
                </h3>
                <p className="text-base font-semibold leading-relaxed">
                  {openQConfig?.prompt || 'Escribe tu respuesta a continuación en inglés:'}
                </p>
              </div>
              {hasTtsSupport && (
                <button
                  type="button"
                  onClick={() => speakText(openQConfig?.prompt || 'Escribe tu respuesta a continuación en inglés:')}
                  className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] text-xs font-bold text-amber-700 hover:text-amber-900 gap-1 rounded-xl px-2.5 py-1.5 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 shrink-0 cursor-pointer"
                  aria-label="Escuchar consigna"
                >
                  <span aria-hidden="true">🔊</span> Escuchar
                </button>
              )}
            </div>
            <textarea
              id="open-question-answer"
              aria-label="Tu respuesta en inglés"
              disabled={isFinished}
              rows={6}
              value={(answers['text'] as string) || ''}
              onChange={(e) => handleAnswerChange('text', e.target.value)}
              placeholder="Escribe aquí tu respuesta detallada…"
              className="w-full rounded-2xl border border-amber-300 p-4 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
            />
          </div>
        )}

        {/* Speaking Type */}
        {activity.type === ActivityType.speaking && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Instrucción de pronunciación / Speaking
              </h3>
              <p className="text-lg font-bold">
                {speakingConfig?.prompt || 'Graba tu voz leyendo la oración en voz alta.'}
              </p>
              {hasTtsSupport && (
                <button
                  type="button"
                  onClick={() => speakText(speakingConfig?.prompt || '')}
                  className="mt-2 text-xs font-bold text-amber-800 bg-amber-200/80 hover:bg-amber-200 px-3 py-1.5 rounded-xl inline-flex items-center justify-center min-h-[48px] min-w-[48px] gap-1.5 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 cursor-pointer"
                  aria-label="Escuchar modelo"
                >
                  <span aria-hidden="true">🔊</span> Escuchar modelo
                </button>
              )}
            </div>

            {/* Recorder Controls */}
            {!isFinished && (
              <div className="p-6 rounded-3xl border border-amber-200 bg-amber-50/40 text-center space-y-4">
                <div className="flex justify-center items-center gap-3">
                  <span
                    className={`inline-block h-4 w-4 rounded-full ${
                      isRecording ? 'bg-rose-500 animate-pulse' : 'bg-zinc-300'
                    }`}
                  />
                  <span className="text-xl font-mono font-bold text-amber-950">
                    {Math.floor(recordingSeconds / 60)
                      .toString()
                      .padStart(2, '0')}
                    :
                    {(recordingSeconds % 60).toString().padStart(2, '0')}
                  </span>
                  <span className="text-xs text-zinc-500">(máx 2:00 min)</span>
                </div>

                <div className="flex justify-center gap-3">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={isUploadingAudio}
                      className="rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-6 py-3 text-sm shadow-md flex items-center justify-center min-h-[48px] min-w-[48px] gap-2 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 cursor-pointer disabled:opacity-50"
                    >
                      <span>🎙️</span>
                      <span>{recordedAudioBlob ? 'Volver a grabar' : 'Empezar a grabar'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold px-6 py-3 text-sm shadow-md flex items-center justify-center min-h-[48px] min-w-[48px] gap-2 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 cursor-pointer"
                    >
                      <span>⏹️</span>
                      <span>Detener grabación</span>
                    </button>
                  )}
                </div>

                {recordedAudioBlob && !isRecording && (
                  <div className="pt-2 flex flex-col items-center gap-1">
                    <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-900">
                      <span>✅</span>
                      <span>Grabación lista para enviar ({recordingSeconds > 0 ? `${recordingSeconds}s` : 'guardada'})</span>
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-2 text-center max-w-sm mx-auto">
                    <p className="font-bold">{uploadError}</p>
                    <button
                      type="button"
                      onClick={uploadAudioRecording}
                      disabled={isUploadingAudio}
                      className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 min-h-[48px] min-w-[48px] shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 cursor-pointer"
                    >
                      {isUploadingAudio ? 'Reintentando…' : 'Reintentar envío'}
                    </button>
                  </div>
                )}

                {uploadProgress && (
                  <p className="text-xs font-semibold text-amber-700 animate-pulse">
                    {uploadProgress}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Microgame Type (SPEC-06, ENG-080 to ENG-085) */}
        {activity.type === ActivityType.game && (
          <GameRenderer
            config={activity.config as GamePublicConfig}
            initialState={answers as GameAnswers}
            onEvent={(event) => {
              if ('itemId' in event && 'answer' in event) {
                handleAnswerChange(event.itemId, event.answer);
              }
            }}
            soundEnabled={soundEnabled}
            theme={theme}
            onComplete={(finalAnswers) => {
              handleCompleteAttempt(finalAnswers as Record<string, unknown>);
            }}
          />
        )}

        {/* Submit Button for standard activities (Microgames provide their own dedicated submit action) */}
        {!isFinished && activity.type !== ActivityType.game && (
          <div className="pt-4 border-t border-amber-200/60 flex justify-end">
            <button
              type="button"
              disabled={isSubmitting || isUploadingAudio}
              onClick={() => handleCompleteAttempt()}
              className="rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-8 py-3.5 text-base shadow-md transition-all disabled:opacity-50 min-h-[48px] min-w-[48px] focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 cursor-pointer"
            >
              {isSubmitting ? 'Entregando actividad…' : 'Entregar actividad ✨'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
