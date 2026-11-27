'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, BookmarkCheck, Check, FileText, Mic, RotateCcw, Square, Star, Trophy, Volume2, VolumeX, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ActivityType,
  AttemptStatus,
  RuntimeView,
  RuntimeViewSchema,
  CompletionView,
  MediaConfirmResponseSchema,
  FillBlankConfig,
  FillBlankConfigSchema,
  ExamConfigSchema,
  SpeakingConfigSchema,
  OpenQuestionConfigSchema,
  GamePublicConfig,
  GameAnswers,
  getOpenQuestionItems,
  scoreToGameStars,
  getGameMotivationMessage,
  AgeSegment,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../../lib/api';
import { GameRenderer } from '../../../../components/activities/GameRenderer';
import gameStyles from '../../../../components/activities/games/kids-game.module.css';
import { ListenButton } from '../../../../components/listen-button';
import { ErrorState } from '../../../../components/error-state';
import { CorrectionFeedback } from '../../../../components/activities/CorrectionFeedback';
import { fireCelebrationConfetti } from '../../../../lib/confetti';
import { uploadAudioBlob } from '../../../../lib/audio-upload';
import { renderBadgeIcon } from '../../../../lib/badges';
import { setActiveAttemptState } from '../../../../lib/pwa-manager';
import { formatBlankPrompt, formatBlankPromptForSpeech } from '../../../../lib/blank-prompt';
import { enqueueEvent, enqueueUpload, triggerFlush, openOfflineDb, getPendingAttemptAnswers, getOfflineUserId } from '../../../../lib/offline-queue';
import { fetchSharedProfile, requestSharedRefresh, getSharedSession } from '../../../../lib/auth-session';

import { ActivityLoading } from './activity-loading';
import styles from './actividad.module.css';
import teensStyles from './actividad-teens.module.css';

function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  return minutes + ':' + (seconds % 60).toString().padStart(2, '0');
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function getNumberProp(obj: unknown, prop: string): number | undefined {
  if (obj !== null && typeof obj === 'object') {
    const val = Reflect.get(obj, prop);
    if (typeof val === 'number') return val;
  }
  return undefined;
}

function getStringRecord(val: unknown): Record<string, string> {
  if (!isRecord(val)) return {};
  const res: Record<string, string> = {};
  for (const [k, v] of Object.entries(val)) {
    if (typeof v === 'string') {
      res[k] = v;
    }
  }
  return res;
}

function isGamePublicConfig(config: unknown): config is GamePublicConfig {
  if (!isRecord(config)) return false;
  return 'mechanic' in config && 'settings' in config;
}

function isGameAnswers(val: unknown): val is GameAnswers {
  return isRecord(val);
}

function isFillBlankConfigLike(config: unknown): config is FillBlankConfig {
  if (!isRecord(config)) return false;
  return 'items' in config && Array.isArray(config.items);
}

interface ActividadRunnerProps {
  attemptId: string;
}

export function ActividadRunner({ attemptId }: ActividadRunnerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [completion, setCompletion] = useState<CompletionView | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [theme, setTheme] = useState<'kids' | 'teens'>(() => {
    return typeof document !== 'undefined' &&
      document.querySelector('[data-theme="teens"]') !== null
      ? 'teens'
      : 'kids';
  });
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return (typeof window !== 'undefined' && getSharedSession()?.user?.id) || '';
  });
  const [isOnline, setIsOnline] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'local' | 'error'>('idle');

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // Speaking state
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!recordedAudioBlob) {
      setAudioPreview(null);
      return;
    }
    const url = URL.createObjectURL(recordedAudioBlob);
    setAudioPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [recordedAudioBlob]);

  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [runnerAlert, setRunnerAlert] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingDurationRef = useRef<number>(0);
  const stopRecordingRef = useRef<() => void>(() => {});
  const pendingEventsRef = useRef<Set<Promise<unknown>>>(new Set());
  const saveFailedRef = useRef(false);
  const initializedAttemptRef = useRef<string | null>(null);

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

  // IndexedDB persistence for offline recovery and failure retry (RF-11, RF-28, §7, P0-05)
  const saveLocalRecording = async (
    id: string,
    blob: Blob,
    userId: string,
    durationSec: number = 0,
    uploadedMediaId: string | null = null,
  ): Promise<boolean> => {
    const effectiveUserId = userId?.trim() || getOfflineUserId() || '';
    if (!effectiveUserId) {
      console.warn('[actividad-runner] Attempted to save local recording without valid userId');
      return false;
    }
    try {
      await enqueueUpload({
          attemptId: id,
          userId: effectiveUserId,
          blob,
          mimeType: blob.type || 'audio/webm',
          durationMs: Math.max(0, Math.round(durationSec * 1000)),
          mediaId: uploadedMediaId,
          attemptToken: runtime?.attemptToken ?? undefined,
          isDraft: true,
      });
      return true;
    } catch {
      return false;
    }
  };

  const loadLocalRecording = async (
    id: string,
    userId: string,
  ): Promise<{ blob: Blob; durationMs: number; mediaId: string | null } | null> => {
    if (!userId || userId !== getOfflineUserId()) return null;
    try {
      const db = await openOfflineDb();
      if (!db.objectStoreNames.contains('pendingUploads')) {
        db.close();
        return null;
      }
      return new Promise<{ blob: Blob; durationMs: number; mediaId: string | null } | null>((resolve) => {
        const tx = db.transaction('pendingUploads', 'readonly');
        const getReq = tx.objectStore('pendingUploads').get(id);
        getReq.onsuccess = () => {
          db.close();
          const rec = getReq.result;
          if (rec && rec.blob instanceof Blob) {
            // Privacy check (P0-05): do not restore recording if belonging to another user
            if (rec.userId !== userId || userId !== getOfflineUserId()) {
              resolve(null);
            } else {
              resolve({
                blob: rec.blob,
                durationMs:
                  typeof rec.durationMs === 'number' && rec.durationMs > 0 ? rec.durationMs : 0,
                mediaId: typeof rec.mediaId === 'string' ? rec.mediaId : null,
              });
            }
          } else {
            resolve(null);
          }
        };
        getReq.onerror = () => { db.close(); resolve(null); };
      });
    } catch {
      return null;
    }
  };

  const clearLocalRecording = async (id: string): Promise<void> => {
    try {
      const db = await openOfflineDb();
      if (!db.objectStoreNames.contains('pendingUploads')) {
        db.close();
        return;
      }
      return new Promise<void>((resolve) => {
        const tx = db.transaction('pendingUploads', 'readwrite');
        tx.objectStore('pendingUploads').delete(id);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); resolve(); };
      });
    } catch {
      // Ignore
    }
  };

  const { data: shellProfile } = useQuery({
    queryKey: ['student', 'profile', 'shell'],
    queryFn: () => fetchSharedProfile(),
    retry: false,
  });

  // Load Attempt Runtime via useQuery (QA-04, T6.2)
  const {
    data: attemptData,
    isLoading,
    isFetching,
    error: queryError,
  } = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: async () => {
      const profile = await fetchSharedProfile().catch(() => null);
      const userId = profile?.user?.id || getSharedSession()?.user?.id || '';
      const pendingAnswers = await getPendingAttemptAnswers(userId, attemptId);
      const [data, savedRec] = await Promise.all([
        apiFetch<RuntimeView>(`/api/v1/attempts/${attemptId}`, {
          schema: RuntimeViewSchema,
        }),
        loadLocalRecording(attemptId, userId),
      ]);
      const restoredData = data.activity.type === ActivityType.game
        ? { ...data, answers: { ...data.answers, ...pendingAnswers } }
        : data;
      return { data: restoredData, profile, savedRec, hasPendingAnswers: Object.keys(pendingAnswers).length > 0 };
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const runtime = attemptData?.data ?? null;
  const maxRecordingSeconds = getNumberProp(runtime?.activity.config, 'maxDurationSeconds') ?? 120;
  const minRecordingSeconds = getNumberProp(runtime?.activity.config, 'minDurationSeconds') ?? 2;

  useEffect(() => {
    if (!attemptData || (attemptData.data.activity.type === ActivityType.game && isFetching) || initializedAttemptRef.current === attemptId) {
      return;
    }

    initializedAttemptRef.current = attemptId;
    const { data, profile, savedRec, hasPendingAnswers } = attemptData;
    const resolvedUserId = profile?.user?.id || getSharedSession()?.user?.id || '';
    if (resolvedUserId) {
      setCurrentUserId(resolvedUserId);
    }
    const ageSegment = profile?.student?.ageSegment ?? 'kids';
    setTheme(ageSegment);
    setSoundEnabled(ageSegment === 'kids'); // soundEnabled starts true for kids, false for teens (RF-9)
    setAnswers((prev) => (Object.keys(prev).length === 0 ? data.answers || {} : prev));
    if (data.mediaId) setMediaId(data.mediaId);
    if (hasPendingAnswers) setSaveStatus('local');
    if (data.attempt.status === AttemptStatus.in_progress) {
      setActiveAttemptState(true); // RF-9: defer update notices during active attempt
    }
    if (
      data.attempt.status === AttemptStatus.graded ||
      data.attempt.status === AttemptStatus.pending_review
    ) {
      setActiveAttemptState(false);
      setCompletion((prev) =>
        prev ?? {
          attempt: data.attempt,
          correction: data.correction ?? null,
          newBadges: [],
        },
      );
    }

    // Restore pending local audio blob if any
    if (savedRec && !data.mediaId) {
      setRecordedAudioBlob(savedRec.blob);
      setMediaId(savedRec.mediaId);
      const restoredSec =
        savedRec.durationMs > 0 ? Math.round(savedRec.durationMs / 1000) : 5;
      if (!savedRec.mediaId) setSaveStatus('local');
      recordingDurationRef.current = Math.max(2, restoredSec);
      setRecordingSeconds(Math.max(2, restoredSec));
    }
  }, [attemptData, attemptId, isFetching]);

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
      setSaveStatus('saving');
      const promise = enqueueEvent({
        userId: currentUserId,
        attemptId,
        clientEventId,
        eventType: 'answered',
        payload: { itemId, answer },
        attemptToken,
      })
        .then(() => {})
        .catch((err) => {
          saveFailedRef.current = true;
          console.warn('[OfflineQueue] Fallback no fatal al encolar evento:', err);
        });

      pendingEventsRef.current.add(promise);
      promise.finally(() => {
        pendingEventsRef.current.delete(promise);
        if (pendingEventsRef.current.size === 0) {
          setSaveStatus(saveFailedRef.current ? 'error' : 'local');
        }
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

  const stopRecording = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('[actividad-runner] Error al detener mediaRecorder:', err);
      }
    }
    setIsRecording(false);
  }, []);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  useEffect(() => {
    return () => {
      setActiveAttemptState(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Audio Recording (Speaking) - Sin clausura obsoleta y cortando en maxDurationSeconds (P1-08.3, RF-6.4)
  const startRecording = async () => {
    try {
      setUploadError(null);
      setMediaId(null);
      setRecordedAudioBlob(null);
      setSaveStatus('idle');
      audioChunksRef.current = [];
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setUploadError('El acceso al micrófono requiere una conexión segura HTTPS o localhost.');
        return;
      }
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
        setSaveStatus('saving');
        void saveLocalRecording(attemptId, audioBlob, currentUserId, recordingDurationRef.current)
          .then((saved) => setSaveStatus(saved ? 'local' : 'error'));

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());

        // Subir y confirmar automáticamente si hay conexión (P1-03, QA-05, T4.3)
        const isOnline = typeof navigator === 'undefined' || navigator.onLine;
        if (recordingDurationRef.current < minRecordingSeconds) {
          setUploadError('Graba al menos ' + minRecordingSeconds + ' segundos.');
        } else if (isOnline && runtime?.attemptToken) {
          void uploadAudioRecording(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingDurationRef.current = 0;

      let elapsed = 0;
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      timerIntervalRef.current = setInterval(() => {
        elapsed += 1;
        recordingDurationRef.current = elapsed;
        setRecordingSeconds(elapsed);
        if (elapsed >= maxRecordingSeconds) {
          stopRecordingRef.current();
        }
      }, 1000);
    } catch {
      setUploadError('Por favor habilita el permiso de micrófono en tu navegador para grabar.');
    }
  };

  const confirmMediaUpload = async (mediaIdToConfirm: string, token: string): Promise<boolean> => {
    try {
      await apiFetch(`/api/v1/media/${mediaIdToConfirm}/confirm`, {
        method: 'POST',
        headers: {
          'x-attempt-token': token,
        },
        schema: MediaConfirmResponseSchema,
      });
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        setUploadError(err.message);
      } else {
        setUploadError('No pudimos validar la grabación en el servidor.');
      }
      return false;
    }
  };

  const uploadAudioRecording = async (blobOverride?: Blob): Promise<string | null> => {
    const uploadUserId = currentUserId || getOfflineUserId();
    if (!uploadUserId || uploadUserId !== getOfflineUserId()) return null;
    const blobToUpload = blobOverride ?? recordedAudioBlob;
    if (!blobToUpload) return mediaId;
    if (recordingDurationRef.current < minRecordingSeconds) {
      setUploadError(`Graba al menos ${minRecordingSeconds} segundos`);
      return null;
    }

    const token = runtime?.attemptToken;
    if (!token) {
      setUploadError('Token de intento no disponible para subir audio.');
      return null;
    }

    setIsUploadingAudio(true);
    setUploadError(null);
    setUploadProgress('Subiendo y confirmando grabación…');
    try {
      // URL firmada + PUT a R2; devuelve el mediaId del contrato (ENG-074)
      const uploadedMediaId = await uploadAudioBlob({
        apiUrl,
        origin: window.location.origin,
        attemptId,
        blob: blobToUpload,
        attemptToken: token,
      });
      if (uploadUserId !== getOfflineUserId()) return null;

      // Confirm immediate audio processing with POST /media/:id/confirm (P1-03, QA-05, T4.3)
      const confirmed = await confirmMediaUpload(uploadedMediaId, token);
      if (uploadUserId !== getOfflineUserId()) return null;
      if (!confirmed) {
        setMediaId(null);
        setUploadProgress(null);
        return null;
      }

      await saveLocalRecording(attemptId, blobToUpload, uploadUserId, recordingDurationRef.current, uploadedMediaId);
      if (uploadUserId !== getOfflineUserId()) return null;
      setMediaId(uploadedMediaId);
      setUploadProgress(null);
      setUploadError(null);
      return uploadedMediaId;
    } catch {
      setUploadProgress(null);
      setUploadError('No pudimos enviar tu grabación. Intenta enviarla otra vez.');
      return null;
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const completeAttemptMutation = useMutation({
    // IndexedDB owns offline delivery. The HTTP mutation must fail instead of pausing.
    networkMode: 'always',
    mutationFn: async ({
      completeBody,
      attemptToken,
    }: {
      completeBody: Record<string, unknown>;
      attemptToken: string;
    }) => {
      let res = await fetch(`${apiUrl}/api/v1/attempts/${attemptId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-attempt-token': attemptToken,
          Origin: window.location.origin,
        },
        credentials: 'include',
        body: JSON.stringify(completeBody),
      });

      if (!res.ok && res.status === 401) {
        const refreshed = await requestSharedRefresh().catch(() => false);
        if (refreshed) {
          res = await fetch(`${apiUrl}/api/v1/attempts/${attemptId}/complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-attempt-token': attemptToken,
              Origin: window.location.origin,
            },
            credentials: 'include',
            body: JSON.stringify(completeBody),
          });
        }
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const msg =
          isRecord(errData) && typeof errData.message === 'string'
            ? errData.message
            : 'Error al entregar la actividad';
        throw new Error(msg);
      }

      const compData: CompletionView = await res.json();
      return compData;
    },
    onSuccess: async (compData) => {
      setCompletion(compData);
      setActiveAttemptState(false);

      // Trigger celebration confetti when student scores >= 3.0 (RF-9, ENG-086)
      if (compData.attempt.score !== null && compData.attempt.score !== undefined && compData.attempt.score >= 3.0) {
        fireCelebrationConfetti({ theme: effectiveTheme });
      }

      // Clean local storage upon confirmed completion (RF-13, RF-28)
      await clearLocalRecording(attemptId);
      queryClient.setQueryData<typeof attemptData>(['attempt', attemptId], (prev) =>
        prev
          ? {
              ...prev,
              data: {
                ...prev.data,
                attempt: compData.attempt,
                correction: compData.correction,
                answers,
              },
              savedRec: null,
            }
          : prev,
      );
      void queryClient.invalidateQueries({ queryKey: ['student'] });
    },
  });

  const playAgainMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const url = `/api/v1/activities/${activityId}/attempts`;
      return apiFetch<RuntimeView>(url, {
        method: 'POST',
        schema: RuntimeViewSchema,
      });
    },
    onSuccess: (res) => {
      if (res?.attempt?.id) {
        window.location.href = `/actividad/${res.attempt.id}`;
      } else {
        router.refresh();
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'No se pudo iniciar un nuevo intento del juego';
      setRunnerAlert(msg);
    },
  });

  const handleCompleteAttempt = async (overrideAnswers?: Record<string, unknown> | GameAnswers) => {
    if (!runtime) return;
    if (isSubmitting || completeAttemptMutation.isPending) return;

    if (isRecording) {
      stopRecording();
      return;
    }
    const attemptToken = runtime.attemptToken;

    const effectiveAnswers: Record<string, unknown> = overrideAnswers
      ? { ...answers, ...overrideAnswers }
      : answers;

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

      // Flush queued events before completing to sync events (ISSUE-05)
      try {
        await triggerFlush(currentUserId);
      } catch (flushErr) {
        console.warn('[OfflineQueue] Flush previo a entrega no fatal:', flushErr);
      }

      if (!navigator.onLine) throw new TypeError('Network request failed');

      if (runtime.activity.type === ActivityType.speaking) {
        if (!recordedAudioBlob && !mediaId) {
          setUploadError('Debes grabar un audio antes de entregar la actividad.');
          setIsSubmitting(false);
          return;
        }
        if (recordedAudioBlob && !mediaId) {
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

      const completeBody: Record<string, unknown> = {
        ...(finalMediaId ? { mediaId: finalMediaId } : {}),
      };
      if (effectiveAnswers && Object.keys(effectiveAnswers).length > 0) {
        completeBody.answers = effectiveAnswers;
      }

      await completeAttemptMutation.mutateAsync({ completeBody, attemptToken: attemptToken || '' });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '';
      const isNetworkError =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        err instanceof TypeError ||
        Boolean(errMsg && /network|fetch|offline|failed to fetch/i.test(errMsg));

      if (isNetworkError) {
        // RF-12: Entrega sin conexión. Queda en la cola y muestra mensaje sin nota ficticia.
        const compEventId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `evt-comp-${Date.now()}`;
        const effectiveUid = currentUserId || (typeof window !== 'undefined' ? getSharedSession()?.user?.id : '') || '';
        try {
          if (recordedAudioBlob) {
            const effectiveDurationMs = Math.max(
              2000,
              (recordingDurationRef.current || recordingSeconds || 2) * 1000,
            );
            await enqueueUpload({
              userId: effectiveUid,
              attemptId,
              blob: recordedAudioBlob,
              mimeType: recordedAudioBlob.type || 'audio/webm',
              durationMs: effectiveDurationMs,
              mediaId: finalMediaId || mediaId || null,
              attemptToken: attemptToken || undefined,
            });
          }

          await enqueueEvent({
            userId: effectiveUid,
            attemptId,
            clientEventId: compEventId,
            eventType: 'completed',
            payload: {
              ...(finalMediaId ? { mediaId: finalMediaId } : mediaId ? { mediaId } : {}),
              answers: effectiveAnswers,
            },
            attemptToken: attemptToken || '',
          });

          setIsOfflineSaved(true);
          setActiveAttemptState(false);
        } catch {
          setRunnerAlert('No pudimos guardar la entrega. Mantén esta página abierta e inténtalo de nuevo.');
        }
      } else {
        setRunnerAlert(errMsg || 'No se pudo completar la entrega');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Play again for microgames (Decision 104, RF-4, Decisión 130, RF-1.5)
  const handlePlayAgain = () => {
    if (!activity?.id) return;
    playAgainMutation.mutate(activity.id);
  };

  const effectiveTheme = attemptData?.profile?.student?.ageSegment ?? shellProfile?.student?.ageSegment ?? theme;
  const isLoadingWithKidsShell = effectiveTheme === 'kids';

  if (isLoading || (runtime?.activity.type === ActivityType.game && isFetching)) {
    return <ActivityLoading />;
  }

  if (!runtime) {
    if (isLoadingWithKidsShell) {
      return (
        <div className={styles.notebook}>
          <div className={styles.unavailable}>
            <ErrorState
              variant="kids"
              code={queryError instanceof ApiError ? queryError.code || queryError.statusCode : undefined}
              message={queryError instanceof ApiError ? undefined : 'No pudimos abrir tu actividad.'}
            />
            <Link href="/inicio" className={styles.primary}>Volver al inicio</Link>
          </div>
        </div>
      );
    }
    return (
      <div className={teensStyles.study}>
        <div className={teensStyles.unavailable}>
          <ErrorState
            variant="teens"
            code={queryError instanceof ApiError ? queryError.code || queryError.statusCode : undefined}
            message={queryError instanceof ApiError ? undefined : 'No pudimos abrir la actividad.'}
          />
          <Link href="/inicio" className={teensStyles.primary}>
            Volver a inicio
          </Link>
        </div>
      </div>
    );
  }

  const { activity, attempt } = runtime;
  const isKids = effectiveTheme === 'kids';
  const isGame = activity.type === ActivityType.game;
  const returnHref = isGame ? '/juegos' : '/inicio';
  const isServerSynced = isOnline && Boolean(
    mediaId || (saveStatus === 'idle' && Object.keys(runtime.answers).length > 0 && !attemptData?.hasPendingAnswers),
  );
  const saveMessage = isServerSynced
    ? isKids
      ? 'Sincronizado con el servidor'
      : 'Respuesta guardada en el servidor'
    : saveStatus === 'local'
      ? 'Guardado en este dispositivo'
      : saveStatus === 'saving'
        ? 'Guardando…'
        : saveStatus === 'error'
          ? 'El guardado local falló'
          : isOnline
            ? null
            : 'Sin conexión';
  const isFinished =
    completion !== null ||
    isOfflineSaved ||
    attempt.status === AttemptStatus.graded ||
    attempt.status === AttemptStatus.pending_review;

  // Render Offline Delivery Receipt (RF-12, §7)
  if (isOfflineSaved) {
    if (isKids) {
      return (
        <div className={styles.receipt}>
          <div className={styles.offlineReceipt}>
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-100 text-4xl shadow-inner mb-4">
              <BookmarkCheck size={42} aria-hidden="true" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-amber-950 mb-3">
              Guardado en este dispositivo
            </h1>
            <p className="text-sm text-zinc-600 max-w-md mx-auto mb-8">
              Tu trabajo se enviará automáticamente cuando vuelva la conexión.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Link href={returnHref} className={styles.primary}>
                {isGame ? 'Volver a juegos' : 'Ir a Mis Misiones'}
              </Link>
              <Link href="/progreso" className={styles.secondary}>
                Ver Mi Progreso
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={teensStyles.receipt}>
        <div className={teensStyles.offlineReceipt}>
          <div className={teensStyles.receiptIconOffline} aria-hidden="true">
            <BookmarkCheck size={34} />
          </div>
          <span className={teensStyles.localStatus} role="status">
            Guardado en este dispositivo
          </span>
          <h1>Guardado en este dispositivo. Se enviará cuando vuelva la conexión.</h1>
          <p className={teensStyles.receiptLead}>
            Tus respuestas quedaron guardadas de forma segura y se sincronizarán automáticamente con el servidor al recuperar la red.
          </p>
          <div className={teensStyles.receiptActions}>
            <Link href={returnHref} className={teensStyles.primary}>
              {isGame ? 'Volver a juegos' : 'Volver a inicio'}
            </Link>
            <Link href="/progreso" className={teensStyles.secondary}>
              Ver mi progreso
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Render Completion Modal/Card
  if (completion) {
    const score = completion.attempt.score;
    const starsCount = completion.attempt.stars ?? scoreToGameStars(score);

    if (isKids) {
      return (
        <div className={styles.receipt}>
          <div className={styles.onlineReceipt}>
            <div aria-hidden="true" className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-100 text-4xl shadow-inner mb-4">
              {activity.type === ActivityType.open_question || activity.type === ActivityType.speaking
                ? '📝'
                : starsCount >= 2
                  ? '🏆'
                  : '⭐'}
            </div>

            <p className={styles.serverStatus} role="status">Sincronizado con el servidor</p>
            <h1 className="text-2xl sm:text-3xl font-black text-amber-950">
              {activity.type === ActivityType.open_question || activity.type === ActivityType.speaking
                ? '¡Actividad entregada con éxito!'
                : isGame
                  ? '¡Partida completada!'
                  : '¡Misión completada!'}
            </h1>

            {isGame ? (
              <div className="mt-4">
                <div className="flex justify-center gap-1.5 text-3xl my-2" role="img" aria-label={starsCount + " de 3 estrellas"}>
                  {[1, 2, 3].map((starIdx) => (
                    <span
                      key={starIdx}
                      className={starIdx <= starsCount ? gameStyles.star : gameStyles.emptyStar}
                      aria-hidden="true"
                    >
                      {starIdx > starsCount ? '☆' : '★'}
                    </span>
                  ))}
                </div>
                <p className="text-base sm:text-lg font-bold text-amber-900 mt-2 max-w-md mx-auto">
                  {completion.attempt.motivationMessage ||
                    getGameMotivationMessage(score ?? 0, AgeSegment.kids)}
                </p>
              </div>
            ) : score !== null && score !== undefined ? (
              <div className="mt-4">
                <div className="flex justify-center gap-1.5 text-3xl my-2" role="img" aria-label={starsCount + " de 3 estrellas"}>
                  {[1, 2, 3].map((starIdx) => (
                    <span
                      key={starIdx}
                      className={starIdx <= starsCount ? 'text-amber-400 drop-shadow-sm' : 'text-zinc-200'}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-2xl font-extrabold text-amber-900 mt-1 tabular-nums">
                  Nota: {score.toFixed(1).replace('.', ',')} / 5,0
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-600 max-w-md mx-auto">
                Tu respuesta ha quedado registrada. Tu profesora la revisará y calificará en los próximos días.
              </p>
            )}

            {/* Retroalimentación de corrección en intentos evaluados (T4.2, P2-04) */}
            {completion.correction && Object.keys(completion.correction).length > 0 && (
              <div className={"mt-4 p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-left max-w-md mx-auto " + styles.correction}>
                <h2 className="text-sm font-bold text-amber-800 mb-2">
                  Retroalimentación de respuestas
                </h2>
                <div className="space-y-1.5 text-xs">
                  <CorrectionFeedback correction={completion.correction} />
                </div>
              </div>
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
              {activity.type === ActivityType.game && (
                <button
                  type="button"
                  onClick={handlePlayAgain}
                  disabled={playAgainMutation.isPending}
                  className={styles.primary}
                >
                  🎮 {playAgainMutation.isPending ? 'Iniciando…' : 'Jugar de nuevo'}
                </button>
              )}
              <Link href={returnHref} className={styles.primary}>
                {isGame ? 'Volver a juegos' : 'Ir a Mis Misiones'}
              </Link>
              <Link href="/progreso" className={styles.secondary}>
                Ver Mi Progreso
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={teensStyles.receipt}>
        <div className={teensStyles.onlineReceipt}>
          <div aria-hidden="true" className={teensStyles.receiptIcon}>
            {activity.type === ActivityType.open_question || activity.type === ActivityType.speaking ? (
              <FileText size={32} />
            ) : starsCount >= 2 ? (
              <Trophy size={32} />
            ) : (
              <Star size={32} />
            )}
          </div>

          <p className={teensStyles.serverStatus} role="status">
            Respuesta guardada en el servidor
          </p>
          <h1>
            {activity.type === ActivityType.open_question || activity.type === ActivityType.speaking
              ? '¡Actividad entregada con éxito!'
              : isGame
                ? '¡Partida completada!'
                : '¡Actividad completada!'}
          </h1>

          {isGame ? (
            <div className="space-y-2">
              <div className={teensStyles.starsRow} role="img" aria-label={starsCount + ' de 3 estrellas'}>
                {[1, 2, 3].map((starIdx) => (
                  <span
                    key={starIdx}
                    className={starIdx <= starsCount ? teensStyles.starFilled : teensStyles.starEmpty}
                    aria-hidden="true"
                  >
                    {starIdx <= starsCount ? '★' : '☆'}
                  </span>
                ))}
              </div>
              <p className={teensStyles.motivation}>
                {completion.attempt.motivationMessage ||
                  getGameMotivationMessage(score ?? 0, AgeSegment.teens)}
              </p>
            </div>
          ) : score !== null && score !== undefined ? (
            <div className="space-y-2">
              <div className={teensStyles.starsRow} role="img" aria-label={starsCount + ' de 3 estrellas'}>
                {[1, 2, 3].map((starIdx) => (
                  <span
                    key={starIdx}
                    className={starIdx <= starsCount ? teensStyles.starFilled : teensStyles.starEmpty}
                    aria-hidden="true"
                  >
                    {starIdx <= starsCount ? '★' : '☆'}
                  </span>
                ))}
              </div>
              <p className={teensStyles.scoreValue}>
                Nota: {score.toFixed(1).replace('.', ',')} / 5,0
              </p>
            </div>
          ) : (
            <p className={teensStyles.receiptLead}>
              Tu respuesta ha quedado registrada. Tu profesora la revisará y calificará en los próximos días.
            </p>
          )}

          {completion.correction && Object.keys(completion.correction).length > 0 && (
            <div className={teensStyles.correction}>
              <h2>Retroalimentación de respuestas</h2>
              <div className={teensStyles.correctionList}>
                <CorrectionFeedback correction={completion.correction} />
              </div>
            </div>
          )}

          {completion.newBadges && completion.newBadges.length > 0 && (
            <div className={teensStyles.badgesPanel}>
              <p className={teensStyles.badgesHeading}>Nueva insignia desbloqueada</p>
              {completion.newBadges.map((b) => (
                <div key={b.id} className={teensStyles.badgeRow}>
                  <span className={teensStyles.badgeIcon} aria-hidden="true">{renderBadgeIcon(b.icon)}</span>
                  <div>
                    <h4 className={teensStyles.badgeName}>{b.name}</h4>
                    <p className={teensStyles.badgeDesc}>{b.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={teensStyles.receiptActions}>
            {activity.type === ActivityType.game && (
              <button
                type="button"
                onClick={handlePlayAgain}
                disabled={playAgainMutation.isPending}
                className={teensStyles.yellow}
              >
                <RotateCcw size={18} aria-hidden="true" />
                <span>{playAgainMutation.isPending ? 'Iniciando…' : 'Jugar de nuevo'}</span>
              </button>
            )}
            <Link href={returnHref} className={teensStyles.primary}>
              {isGame ? 'Volver a juegos' : 'Volver a inicio'}
            </Link>
            <Link href="/progreso" className={teensStyles.secondary}>
              Ver mi progreso
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Activity Configuration Rendering
  const parsedFb = FillBlankConfigSchema.safeParse(activity.config);
  const fbConfig: FillBlankConfig | null = parsedFb.success
    ? parsedFb.data
    : isFillBlankConfigLike(activity.config)
      ? activity.config
      : null;
  const parsedExam = ExamConfigSchema.safeParse(activity.config);
  const examConfig = parsedExam.success ? parsedExam.data : null;
  const parsedSpeaking = SpeakingConfigSchema.safeParse(activity.config);
  const speakingConfig = parsedSpeaking.success ? parsedSpeaking.data : null;
  const openQItems = getOpenQuestionItems(activity.config, activity.id);
  const parsedOpenQ = OpenQuestionConfigSchema.safeParse(activity.config);
  const openQInstructions = parsedOpenQ.success ? parsedOpenQ.data.instructions : undefined;

  return (
    <div className={isKids ? styles.notebook : teensStyles.study}>
      {runnerAlert && (
        <div
          role="alert"
          className={isKids ? styles.alert : teensStyles.alert}
        >
          <span>{isKids ? `⚠️ ${runnerAlert}` : runnerAlert}</span>
          <button
            type="button"
            onClick={() => setRunnerAlert(null)}
            className={
              isKids
                ? 'font-bold text-rose-600 hover:text-rose-800 ml-4 min-h-12 min-w-12 shrink-0 focus:outline-none focus:ring-2 focus:ring-rose-500 rounded-lg p-1'
                : teensStyles.alertClose
            }
            aria-label="Cerrar aviso"
          >
            {isKids ? '✕' : <X size={18} aria-hidden="true" />}
          </button>
        </div>
      )}

      {/* Activity Header Bar */}
      <header data-game={isGame || undefined} className={isKids ? styles.header : teensStyles.header}>
        {isKids ? (
          <div className={styles.notebookBar}>
            <Link href={returnHref} className={styles.back}>
              <ArrowLeft size={20} aria-hidden="true" /> Volver a mi ruta
            </Link>
            <span className={styles.notebookLabel}><BookOpen size={18} aria-hidden="true" /> Cuaderno de campo</span>
          </div>
        ) : (
          <div className={teensStyles.topBar}>
            <Link href={returnHref} className={teensStyles.back}>
              <ArrowLeft size={18} aria-hidden="true" />
              <span>{isGame ? 'Volver a juegos' : 'Volver a inicio'}</span>
            </Link>
            {saveMessage && (
              <span
                role="status"
                className={
                  isServerSynced
                    ? teensStyles.serverStatus
                    : saveStatus === 'error'
                      ? teensStyles.errorStatus
                      : saveStatus === 'saving'
                        ? teensStyles.savingStatus
                        : teensStyles.localStatus
                }
              >
                {saveMessage}
              </span>
            )}
          </div>
        )}
        <div className={isKids ? 'min-w-0' : teensStyles.headerMain}>
          <div className={isKids ? 'flex flex-wrap items-center gap-2 mb-1' : teensStyles.metaRow}>
            <span className={isKids ? 'px-2 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800' : teensStyles.metaPill}>
              Nivel {activity.level}
            </span>
            <span className={isKids ? 'text-xs font-semibold text-zinc-500' : teensStyles.metaPill}>
              Intento #{attempt.attemptNumber}
            </span>
            {attempt.status === 'in_progress' && attempt.completeUntil && (
              <span className={isKids ? 'text-xs font-bold text-amber-900 bg-amber-100/90 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1' : teensStyles.deadlinePill}>
                {isKids && <span aria-hidden="true">⏳</span>}
                <span>
                  Termina antes de:{' '}
                  {new Date(attempt.completeUntil).toLocaleDateString('es-CO', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'America/Bogota',
                  })}
                </span>
              </span>
            )}
          </div>
          <h1 lang="en" className={isKids ? 'text-xl sm:text-2xl font-black text-amber-950' : undefined}>{activity.title}</h1>
        </div>

        {(activity.type === ActivityType.game || isKids) && (
          <div className={isKids ? 'flex flex-wrap items-center gap-2' : teensStyles.headerActions}>
            {activity.type === ActivityType.game && (
              <button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                className={
                  isKids
                    ? `${gameStyles.externalControl} inline-flex items-center justify-center min-h-[48px] min-w-[48px] gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2`
                    : teensStyles.soundToggle
                }
                aria-pressed={soundEnabled}
                title={soundEnabled ? 'Silenciar efectos de sonido' : 'Activar efectos de sonido'}
              >
                {isKids ? (
                  <>
                    <span aria-hidden="true">{soundEnabled ? '🔊' : '🔇'}</span>
                    <span>{soundEnabled ? 'Sonido sí' : 'Sonido no'}</span>
                  </>
                ) : (
                  <>
                    {soundEnabled ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
                    <span>{soundEnabled ? 'Sonido: Activado' : 'Sonido: Silenciado'}</span>
                  </>
                )}
              </button>
            )}

            {isKids && <ListenButton text={activity.title} />}
          </div>
        )}
        {isKids && (
          <div className={styles.statusLine} role="status">
            {saveMessage && (
              <span className={isServerSynced ? styles.serverStatus : styles.localStatus}>
                {saveMessage}
              </span>
            )}
          </div>
        )}
      </header>

      {/* Runner Body by Activity Type */}
      <div className={isKids
        ? isGame ? 'min-w-0' : styles.body
        : isGame ? 'min-w-0' : teensStyles.body}>
        {/* Fill in the Blank Type */}
        {activity.type === ActivityType.fill_blank && fbConfig?.items && (
          <div className="space-y-6">
            <p className={isKids ? 'text-xs font-bold uppercase tracking-wider text-amber-800' : teensStyles.sectionLead}>
              Completa los espacios en blanco con la palabra correcta:
            </p>
            {fbConfig.items.map((item, itemIdx) => (
              <div
                key={item.id}
                data-question=""
                className={isKids ? 'p-5 rounded-2xl bg-amber-50/50 border border-amber-200/60 space-y-3' : teensStyles.questionCard}
              >
                <div className={isKids ? 'flex items-center justify-between' : teensStyles.questionMeta}>
                  <span className={isKids ? 'text-xs font-extrabold text-amber-800' : undefined}>Pregunta {itemIdx + 1}</span>
                  {isKids && (
                    <ListenButton text={formatBlankPromptForSpeech(item.prompt)} />
                  )}
                </div>
                <p lang="en" className={isKids ? 'text-base sm:text-lg font-medium text-amber-950 leading-relaxed' : teensStyles.promptText}>
                  {formatBlankPrompt(item.prompt, item.blanks)}
                </p>

                {/* Blank inputs */}
                <div className={isKids ? 'grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2' : teensStyles.blanksGrid}>
                  {item.blanks.map((blank, blankIdx) => {
                    const itemAnswers = getStringRecord(answers[item.id]);
                    const rawBlankVal = itemAnswers[blank.id] || answers[blank.id];
                    const currentVal = typeof rawBlankVal === 'string' ? rawBlankVal : '';
                    const blankInputId = `blank-${item.id}-${blank.id || blankIdx}`;
                    const blankLabel = `Espacio ${blankIdx + 1}`;
                    return (
                      <div key={blank.id || `blank-${blankIdx}`} className={isKids ? 'space-y-1' : teensStyles.fieldGroup}>
                        <label htmlFor={blankInputId} className={isKids ? 'text-xs font-bold text-zinc-600 block' : teensStyles.fieldLabel}>
                          Espacio {blankIdx + 1}:
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
                            className={isKids ? 'w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px]' : teensStyles.select}
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
                            className={isKids ? 'w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px]' : teensStyles.input}
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
            <p className={isKids ? 'text-xs font-bold uppercase tracking-wider text-amber-800' : teensStyles.sectionLead}>
              Examen — Responde cada una de las oraciones:
            </p>
            {examConfig.items.map((item, itemIdx) => {
              const itemAnswers = getStringRecord(answers[item.id]);
              return (
                <div
                  key={item.id}
                  data-question=""
                  className={isKids ? 'p-5 rounded-2xl bg-amber-50/50 border border-amber-200/60 space-y-3' : teensStyles.questionCard}
                >
                  <div className={isKids ? 'flex items-center justify-between' : teensStyles.questionMeta}>
                    <span className={isKids ? 'text-xs font-extrabold text-amber-800' : undefined}>
                      Ítem #{itemIdx + 1} (Peso: {item.weight})
                    </span>
                    {isKids && (
                      <ListenButton text={formatBlankPromptForSpeech(item.prompt)} />
                    )}
                  </div>
                  <p lang="en" className={isKids ? 'text-base sm:text-lg font-medium text-amber-950 leading-relaxed' : teensStyles.promptText}>
                    {formatBlankPrompt(item.prompt, item.blanks)}
                  </p>
                  <div className={isKids ? 'grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2' : teensStyles.blanksGrid}>
                    {item.blanks.map((b, bIdx) => {
                      const examInputId = `exam-blank-${item.id}-${b.id || bIdx}`;
                      const examLabel = `Espacio ${bIdx + 1} del ítem ${itemIdx + 1}`;
                      return (
                        <div key={b.id || `blank-${bIdx}`} className={isKids ? 'space-y-1' : teensStyles.fieldGroup}>
                          <label htmlFor={examInputId} className={isKids ? 'text-xs font-bold text-zinc-600 block' : teensStyles.fieldLabel}>
                            Espacio {bIdx + 1}:
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
                              className={isKids ? 'w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px]' : teensStyles.select}
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
                              className={isKids ? 'w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[48px]' : teensStyles.input}
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

        {/* Open Question Type (RFC-01: multi-pregunta y monoriguroso) */}
        {activity.type === ActivityType.open_question && (
          <div className="space-y-6">
            {openQInstructions && (
              <div className={isKids ? 'p-4 rounded-2xl bg-amber-100/70 border border-amber-300 text-amber-950' : teensStyles.instructionsBox}>
                <span className={isKids ? 'text-xs font-bold uppercase tracking-wider text-amber-800 block mb-1' : teensStyles.instructionsLabel}>
                  Instrucciones generales
                </span>
                <p className={isKids ? 'text-sm font-medium' : teensStyles.instructionsText}>{openQInstructions}</p>
              </div>
            )}

            {openQItems.map((item, idx) => {
              const isSingleItem = openQItems.length === 1;
              const rawItemAns = answers[item.id];
              const rawTextAns = answers['text'];
              const itemAnswer =
                (typeof rawItemAns === 'string' ? rawItemAns : undefined) ??
                (isSingleItem && typeof rawTextAns === 'string' ? rawTextAns : '') ??
                '';
              const maxLen = item.maxLength || 2000;

              return (
                <div
                  key={item.id}
                  data-question=""
                  className={isKids ? 'space-y-3 p-5 rounded-2xl bg-white border border-amber-200 shadow-xs' : teensStyles.questionCard}
                >
                  <div
                    data-prompt=""
                    className={
                      isKids
                        ? 'p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'
                        : 'flex flex-col gap-2'
                    }
                  >
                    <div>
                      <h2 className={isKids ? 'text-xs font-bold uppercase tracking-wider text-amber-800 mb-1' : teensStyles.questionMeta}>
                        {!isSingleItem ? `Pregunta ${idx + 1}` : 'Pregunta abierta'}
                      </h2>
                      <p lang={item.prompt ? 'en' : undefined} className={isKids ? 'text-base font-semibold leading-relaxed' : teensStyles.promptText}>
                        {item.prompt || 'Escribe tu respuesta a continuación en inglés:'}
                      </p>
                    </div>
                    {isKids && (
                      <ListenButton text={item.prompt || 'Escribe tu respuesta a continuación en inglés:'} />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <textarea
                      id={`open-question-answer-${item.id}`}
                      aria-label={`Tu respuesta en inglés para pregunta ${idx + 1}`}
                      disabled={isFinished}
                      rows={isKids ? 5 : !isSingleItem ? 4 : 6}
                      maxLength={maxLen}
                      value={itemAnswer}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleAnswerChange(item.id, val);
                        if (isSingleItem) {
                          handleAnswerChange('text', val);
                        }
                      }}
                      placeholder="Escribe aquí tu respuesta detallada…"
                      className={isKids ? 'w-full rounded-2xl border border-amber-300 p-4 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed' : teensStyles.textarea}
                    />
                    <div className={isKids ? 'flex justify-end text-[11px] font-semibold text-zinc-400' : teensStyles.counter}>
                      <span>{itemAnswer.length} / {maxLen} caracteres</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Speaking Type */}
        {activity.type === ActivityType.speaking && (
          <div className="space-y-6">
            <div
              data-question=""
              data-speaking-prompt=""
              className={isKids ? 'p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2' : teensStyles.questionCard}
            >
              <div>
                <h2 className={isKids ? 'text-xs font-bold uppercase tracking-wider text-amber-800' : teensStyles.questionMeta}>
                  {isKids ? 'Lee en voz alta' : 'Speaking · Lee en voz alta'}
                </h2>
                <p lang={speakingConfig?.prompt ? 'en' : undefined} className={isKids ? 'text-lg font-bold' : teensStyles.promptText}>
                  {speakingConfig?.prompt || 'Graba tu voz leyendo la oración en voz alta.'}
                </p>
              </div>
              {isKids && (
                <ListenButton text={speakingConfig?.prompt || ''} />
              )}
            </div>

            {/* Recorder Controls */}
            {!isFinished && (
              <div className={isKids ? styles.recorder : teensStyles.recorder}>
                <div className={isKids ? 'flex justify-center items-center gap-3' : teensStyles.recorderMeta}>
                  <span
                    className={
                      isKids
                        ? `inline-block h-4 w-4 rounded-full ${isRecording ? 'bg-rose-500 animate-pulse' : 'bg-zinc-300'}`
                        : `${teensStyles.recordDot} ${isRecording ? teensStyles.recordDotActive : ''}`
                    }
                    aria-hidden="true"
                  />
                  {!isKids && (
                    <div className={teensStyles.waveBars} data-recording={isRecording ? 'true' : 'false'} aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                  <span className={isKids ? styles.clock : teensStyles.clock}>
                    {formatClock(recordingSeconds)} / {formatClock(maxRecordingSeconds)}
                  </span>
                </div>
                <p className={isKids ? 'text-sm' : teensStyles.recorderHint}>Graba al menos {minRecordingSeconds} segundos.</p>

                <div className="flex justify-center gap-3 w-full">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={isUploadingAudio || isSubmitting}
                      data-record=""
                      className={
                        isKids
                          ? 'rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-6 py-3 text-sm shadow-md flex items-center justify-center min-h-[48px] min-w-[48px] gap-2 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 cursor-pointer disabled:opacity-50'
                          : teensStyles.recordBtn
                      }
                    >
                      <Mic size={20} aria-hidden="true" />
                      <span>{recordedAudioBlob ? 'Volver a grabar' : 'Grabar audio'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      data-record="stop"
                      className={
                        isKids
                          ? 'rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold px-6 py-3 text-sm shadow-md flex items-center justify-center min-h-[48px] min-w-[48px] gap-2 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 cursor-pointer'
                          : teensStyles.stopBtn
                      }
                    >
                      <Square size={18} aria-hidden="true" />
                      <span>Detener grabación</span>
                    </button>
                  )}
                </div>

                {recordedAudioBlob && !isRecording && (
                  <div className={isKids ? 'pt-2 flex flex-col items-center gap-1' : teensStyles.previewBox}>
                    {recordingSeconds >= minRecordingSeconds && (
                      <div className={isKids ? 'inline-flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-900' : teensStyles.readyPill}>
                        <Check size={16} aria-hidden="true" />
                        <span>Grabación lista para enviar ({recordingSeconds} s)</span>
                      </div>
                    )}
                    {audioPreview && (
                      <audio
                        className={isKids ? styles.preview : teensStyles.preview}
                        controls
                        src={audioPreview}
                        aria-label="Escuchar tu grabación"
                      />
                    )}
                  </div>
                )}

                {uploadError && (
                  <div className={isKids ? 'p-3 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-2 text-center max-w-sm mx-auto' : teensStyles.uploadAlert}>
                    <p className="font-bold" role="alert">{uploadError}</p>
                    <button
                      type="button"
                      onClick={() => void uploadAudioRecording()}
                      disabled={isUploadingAudio || !isOnline || !recordedAudioBlob || recordingSeconds < minRecordingSeconds}
                      data-retry=""
                      className={
                        isKids
                          ? 'rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 min-h-[48px] min-w-[48px] shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 cursor-pointer'
                          : teensStyles.primary
                      }
                    >
                      {isUploadingAudio ? 'Reintentando…' : 'Reintentar envío'}
                    </button>
                  </div>
                )}

                {uploadProgress && (
                  <p role="status" className={isKids ? 'text-sm font-semibold text-amber-900' : teensStyles.uploadStatus}>
                    {uploadProgress}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Microgame Type (SPEC-06, ENG-080 to ENG-085) */}
        {activity.type === ActivityType.game && isGamePublicConfig(activity.config) && (
          <GameRenderer
            config={activity.config}
            initialState={isGameAnswers(runtime.answers) ? runtime.answers : {}}
            onEvent={(event) => {
              if ('itemId' in event && 'answer' in event) {
                handleAnswerChange(event.itemId, event.answer);
              }
            }}
            soundEnabled={soundEnabled}
            theme={effectiveTheme}
            onComplete={(finalAnswers) => {
              handleCompleteAttempt(finalAnswers);
            }}
          />
        )}

        {/* Submit Button for standard activities (Microgames provide their own dedicated submit action) */}
        {!isFinished && activity.type !== ActivityType.game && (
          <div className={isKids ? styles.footer : teensStyles.footer}>
            <button
              type="button"
              disabled={
                isSubmitting ||
                isUploadingAudio ||
                (activity.type === ActivityType.speaking &&
                  (isRecording || (!mediaId && (!recordedAudioBlob || recordingSeconds < minRecordingSeconds))))
              }
              onClick={() => handleCompleteAttempt()}
              className={isKids ? styles.primary : teensStyles.primary}
            >
              {isSubmitting ? 'Entregando actividad…' : 'Entregar actividad'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
