"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "@upward-english/shared";
import { apiFetch, ApiError } from "../../../../lib/api";
import {
  OpenQuestionRenderer,
  SentenceRenderer,
  SpeakingRenderer,
} from "../../../../components/activities/DidacticRenderers";
import { GameRenderer } from "../../../../components/activities/GameRenderer";
import { CorrectionFeedback } from "../../../../components/activities/CorrectionFeedback";
import { Star } from "lucide-react";
import styles from "./actividad.module.css";
import { fireCelebrationConfetti } from "../../../../lib/confetti";
import { uploadAudioBlob } from "../../../../lib/audio-upload";
import { renderBadgeIcon } from "../../../../lib/badges";
import { setActiveAttemptState } from "../../../../lib/pwa-manager";
import { speak } from "../../../../lib/speech";
import {
  enqueueEvent,
  enqueueUpload,
  triggerFlush,
  openOfflineDb,
  getPendingAttemptAnswers,
  getOfflineUserId,
} from "../../../../lib/offline-queue";
import {
  fetchSharedProfile,
  requestSharedRefresh,
  getSharedSession,
} from "../../../../lib/auth-session";

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function getNumberProp(obj: unknown, prop: string): number | undefined {
  if (obj !== null && typeof obj === "object") {
    const val = Reflect.get(obj, prop);
    if (typeof val === "number") return val;
  }
  return undefined;
}

function isGamePublicConfig(config: unknown): config is GamePublicConfig {
  if (!isRecord(config)) return false;
  return "mechanic" in config && "settings" in config;
}

function isGameAnswers(val: unknown): val is GameAnswers {
  return isRecord(val);
}

function isFillBlankConfigLike(config: unknown): config is FillBlankConfig {
  if (!isRecord(config)) return false;
  return "items" in config && Array.isArray(config.items);
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
  const [theme, setTheme] = useState<"kids" | "teens">("kids");
  const [isQueued, setIsQueued] = useState(false);
  const [revealStars, setRevealStars] = useState(false);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusResultRef = useRef(false);

  useEffect(() => {
    if (
      (completion || isQueued) &&
      focusResultRef.current &&
      resultHeadingRef.current
    ) {
      focusResultRef.current = false;
      resultHeadingRef.current.focus();
    }
  }, [completion, isQueued]);

  useEffect(() => {
    if (!revealStars) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stopReveal = (event: MediaQueryListEvent) => {
      if (event.matches) setRevealStars(false);
    };
    motion.addEventListener("change", stopReveal);
    return () => motion.removeEventListener("change", stopReveal);
  }, [revealStars]);

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return (
      (typeof window !== "undefined" && getSharedSession()?.user?.id) || ""
    );
  });
  const [hasTtsSupport, setHasTtsSupport] = useState(false);

  // Check TTS support (RF-22)
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const checkVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setHasTtsSupport(
          voices.length > 0 || !("onvoiceschanged" in window.speechSynthesis),
        );
      };
      checkVoices();
      if ("onvoiceschanged" in window.speechSynthesis) {
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
  const [runnerAlert, setRunnerAlert] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingDurationRef = useRef<number>(0);
  const stopRecordingRef = useRef<() => void>(() => {});
  const pendingEventsRef = useRef<Set<Promise<unknown>>>(new Set());
  const initializedAttemptRef = useRef<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // MIME detection in preference order (architecture §3.5)
  const getSupportedMimeType = (): string => {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined")
      return "audio/webm";
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  };

  // IndexedDB persistence for offline recovery and failure retry (RF-11, RF-28, §7, P0-05)
  const saveLocalRecording = async (
    id: string,
    blob: Blob,
    userId: string,
    durationSec: number = 0,
    uploadedMediaId: string | null = null,
  ): Promise<void> => {
    const effectiveUserId = userId?.trim() || getOfflineUserId() || "";
    if (!effectiveUserId) {
      console.warn(
        "[actividad-runner] Attempted to save local recording without valid userId",
      );
      return;
    }
    try {
      await enqueueUpload({
        attemptId: id,
        userId: effectiveUserId,
        blob,
        mimeType: blob.type || "audio/webm",
        durationMs: Math.max(0, Math.round(durationSec * 1000)),
        mediaId: uploadedMediaId,
        attemptToken: runtime?.attemptToken ?? undefined,
        isDraft: true,
      });
    } catch {
      // Ignore
    }
  };

  const loadLocalRecording = async (
    id: string,
    userId: string,
  ): Promise<{
    blob: Blob;
    durationMs: number;
    mediaId: string | null;
  } | null> => {
    if (!userId || userId !== getOfflineUserId()) return null;
    try {
      const db = await openOfflineDb();
      if (!db.objectStoreNames.contains("pendingUploads")) {
        db.close();
        return null;
      }
      return new Promise<{
        blob: Blob;
        durationMs: number;
        mediaId: string | null;
      } | null>((resolve) => {
        const tx = db.transaction("pendingUploads", "readonly");
        const getReq = tx.objectStore("pendingUploads").get(id);
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
                  typeof rec.durationMs === "number" && rec.durationMs > 0
                    ? rec.durationMs
                    : 0,
                mediaId: typeof rec.mediaId === "string" ? rec.mediaId : null,
              });
            }
          } else {
            resolve(null);
          }
        };
        getReq.onerror = () => {
          db.close();
          resolve(null);
        };
      });
    } catch {
      return null;
    }
  };

  const clearLocalRecording = async (id: string): Promise<void> => {
    try {
      const db = await openOfflineDb();
      if (!db.objectStoreNames.contains("pendingUploads")) {
        db.close();
        return;
      }
      return new Promise<void>((resolve) => {
        const tx = db.transaction("pendingUploads", "readwrite");
        tx.objectStore("pendingUploads").delete(id);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      });
    } catch {
      // Ignore
    }
  };

  // Load Attempt Runtime via useQuery (QA-04, T6.2)
  const {
    data: attemptData,
    isLoading,
    isFetching,
    error: queryError,
  } = useQuery({
    queryKey: ["attempt", attemptId],
    queryFn: async () => {
      const profile = await fetchSharedProfile().catch(() => null);
      const userId = profile?.user?.id || getSharedSession()?.user?.id || "";
      const pendingAnswers = await getPendingAttemptAnswers(userId, attemptId);
      const [data, savedRec] = await Promise.all([
        apiFetch<RuntimeView>(`/api/v1/attempts/${attemptId}`, {
          schema: RuntimeViewSchema,
        }),
        loadLocalRecording(attemptId, userId),
      ]);
      const restoredData =
        data.activity.type === ActivityType.game
          ? { ...data, answers: { ...data.answers, ...pendingAnswers } }
          : data;
      return { data: restoredData, profile, savedRec };
    },
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const runtime = attemptData?.data ?? null;
  const error =
    queryError instanceof ApiError
      ? queryError.message
      : queryError instanceof Error
        ? queryError.message
        : queryError
          ? "No se pudo cargar la actividad"
          : null;

  useEffect(() => {
    if (
      !attemptData ||
      (attemptData.data.activity.type === ActivityType.game && isFetching) ||
      initializedAttemptRef.current === attemptId
    ) {
      return;
    }

    initializedAttemptRef.current = attemptId;
    const { data, profile, savedRec } = attemptData;
    const resolvedUserId =
      profile?.user?.id || getSharedSession()?.user?.id || "";
    if (resolvedUserId) {
      setCurrentUserId(resolvedUserId);
    }
    const ageSegment = profile?.student?.ageSegment ?? "kids";
    setTheme(ageSegment);
    setSoundEnabled(ageSegment === "kids"); // soundEnabled starts true for kids, false for teens (RF-9)
    setAnswers((prev) =>
      Object.keys(prev).length === 0 ? data.answers || {} : prev,
    );
    if (data.mediaId) setMediaId(data.mediaId);
    if (data.attempt.status === AttemptStatus.in_progress) {
      setActiveAttemptState(true); // RF-9: defer update notices during active attempt
    }
    if (
      data.attempt.status === AttemptStatus.graded ||
      data.attempt.status === AttemptStatus.pending_review
    ) {
      setActiveAttemptState(false);
      setCompletion(
        (prev) =>
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
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `evt-${Date.now()}-${Math.random()}`;

      // 1. Guardar primero en IndexedDB (RF-10) y vaciar con la cola automática (RF-11); at/createdAt nunca viaja a la API (Decisión 37)
      const promise = enqueueEvent({
        userId: currentUserId,
        attemptId,
        clientEventId,
        eventType: "answered",
        payload: { itemId, answer },
        attemptToken,
      })
        .then(() => {})
        .catch((err) => {
          console.warn(
            "[OfflineQueue] Fallback no fatal al encolar evento:",
            err,
          );
        });

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
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      speak(text);
    }
  };

  const stopRecording = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn("[actividad-runner] Error al detener mediaRecorder:", err);
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
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
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
      audioChunksRef.current = [];
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setUploadError(
          "El acceso al micrófono requiere una conexión segura HTTPS o localhost.",
        );
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
        const mimeType =
          mediaRecorder.mimeType || preferredMime || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedAudioBlob(audioBlob);
        void saveLocalRecording(
          attemptId,
          audioBlob,
          currentUserId,
          recordingDurationRef.current,
        );

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());

        // Subir y confirmar automáticamente si hay conexión (P1-03, QA-05, T4.3)
        const isOnline = typeof navigator === "undefined" || navigator.onLine;
        if (isOnline && runtime?.attemptToken) {
          void uploadAudioRecording(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingDurationRef.current = 0;

      const maxSec =
        getNumberProp(runtime?.activity?.config, "maxDurationSeconds") ?? 120;
      let elapsed = 0;
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      timerIntervalRef.current = setInterval(() => {
        elapsed += 1;
        recordingDurationRef.current = elapsed;
        setRecordingSeconds(elapsed);
        if (elapsed >= maxSec) {
          stopRecordingRef.current();
        }
      }, 1000);
    } catch {
      setUploadError(
        "Por favor habilita el permiso de micrófono en tu navegador para grabar.",
      );
    }
  };

  const confirmMediaUpload = async (
    mediaIdToConfirm: string,
    token: string,
  ): Promise<boolean> => {
    try {
      await apiFetch(`/api/v1/media/${mediaIdToConfirm}/confirm`, {
        method: "POST",
        headers: {
          "x-attempt-token": token,
        },
        schema: MediaConfirmResponseSchema,
      });
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        setUploadError(err.message);
      } else {
        setUploadError("No pudimos validar la grabación en el servidor.");
      }
      return false;
    }
  };

  const uploadAudioRecording = async (
    blobOverride?: Blob,
  ): Promise<string | null> => {
    const uploadUserId = currentUserId || getOfflineUserId();
    if (!uploadUserId || uploadUserId !== getOfflineUserId()) return null;
    const blobToUpload = blobOverride ?? recordedAudioBlob;
    if (!blobToUpload) return mediaId;
    const minSec =
      getNumberProp(runtime?.activity?.config, "minDurationSeconds") ?? 2;
    if (recordingDurationRef.current < minSec) {
      setUploadError(`Graba al menos ${minSec} segundos`);
      return null;
    }

    const token = runtime?.attemptToken;
    if (!token) {
      setUploadError("Token de intento no disponible para subir audio.");
      return null;
    }

    setIsUploadingAudio(true);
    setUploadError(null);
    setUploadProgress("Subiendo y confirmando grabación…");
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

      await saveLocalRecording(
        attemptId,
        blobToUpload,
        uploadUserId,
        recordingDurationRef.current,
        uploadedMediaId,
      );
      if (uploadUserId !== getOfflineUserId()) return null;
      setMediaId(uploadedMediaId);
      setUploadProgress(null);
      setUploadError(null);
      return uploadedMediaId;
    } catch {
      setUploadProgress(null);
      setUploadError(
        "No pudimos enviar tu grabación. Sigue guardada en este dispositivo.",
      );
      return null;
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const completeAttemptMutation = useMutation({
    mutationFn: async ({
      completeBody,
      attemptToken,
    }: {
      completeBody: Record<string, unknown>;
      attemptToken: string;
    }) => {
      let res = await fetch(`${apiUrl}/api/v1/attempts/${attemptId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-attempt-token": attemptToken,
          Origin: window.location.origin,
        },
        credentials: "include",
        body: JSON.stringify(completeBody),
      });

      if (!res.ok && res.status === 401) {
        const refreshed = await requestSharedRefresh().catch(() => false);
        if (refreshed) {
          res = await fetch(`${apiUrl}/api/v1/attempts/${attemptId}/complete`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-attempt-token": attemptToken,
              Origin: window.location.origin,
            },
            credentials: "include",
            body: JSON.stringify(completeBody),
          });
        }
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const msg =
          isRecord(errData) && typeof errData.message === "string"
            ? errData.message
            : "Error al entregar la actividad";
        throw new Error(msg);
      }

      const compData: CompletionView = await res.json();
      return compData;
    },
    onSuccess: async (compData) => {
      focusResultRef.current = true;
      setRevealStars(
        runtime?.activity.type === ActivityType.game &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
      setCompletion(compData);
      setActiveAttemptState(false);

      // Clean local storage upon confirmed completion (RF-13, RF-28)
      await clearLocalRecording(attemptId);
      queryClient.setQueryData<typeof attemptData>(
        ["attempt", attemptId],
        (prev) =>
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
      void queryClient.invalidateQueries({ queryKey: ["student"] });
    },
  });

  const playAgainMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const url = `/api/v1/activities/${activityId}/attempts`;
      return apiFetch<RuntimeView>(url, {
        method: "POST",
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
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudo iniciar un nuevo intento del juego";
      setRunnerAlert(msg);
    },
  });

  const handleCompleteAttempt = async (
    overrideAnswers?: Record<string, unknown> | GameAnswers,
  ) => {
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
        console.warn(
          "[OfflineQueue] Flush previo a entrega no fatal:",
          flushErr,
        );
      }

      if (runtime.activity.type === ActivityType.speaking) {
        if (!recordedAudioBlob && !mediaId) {
          setUploadError(
            "Debes grabar un audio antes de entregar la actividad.",
          );
          setIsSubmitting(false);
          return;
        }
        if (recordedAudioBlob && !mediaId) {
          const isCurrentlyOffline =
            typeof navigator !== "undefined" && !navigator.onLine;
          if (isCurrentlyOffline) {
            throw new TypeError("Network request failed");
          }
          finalMediaId = await uploadAudioRecording();
          if (!finalMediaId) {
            const isOfflineNow =
              (typeof navigator !== "undefined" && !navigator.onLine) ||
              Boolean(uploadError);
            if (isOfflineNow) {
              throw new TypeError("Network request failed");
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

      await completeAttemptMutation.mutateAsync({
        completeBody,
        attemptToken: attemptToken || "",
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "";
      const isNetworkError =
        (typeof navigator !== "undefined" && !navigator.onLine) ||
        err instanceof TypeError ||
        Boolean(
          errMsg && /network|fetch|offline|failed to fetch/i.test(errMsg),
        );

      if (isNetworkError) {
        // RF-12: Entrega sin conexión. Queda en la cola y muestra mensaje sin nota ficticia.
        const compEventId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `evt-comp-${Date.now()}`;
        const effectiveUid =
          currentUserId ||
          (typeof window !== "undefined" ? getSharedSession()?.user?.id : "") ||
          "";
        await enqueueEvent({
          userId: effectiveUid,
          attemptId,
          clientEventId: compEventId,
          eventType: "completed",
          payload: {
            ...(finalMediaId
              ? { mediaId: finalMediaId }
              : mediaId
                ? { mediaId }
                : {}),
            answers: effectiveAnswers,
          },
          attemptToken: attemptToken || "",
        });

        if (recordedAudioBlob) {
          const effectiveDurationMs = Math.max(
            2000,
            (recordingDurationRef.current || recordingSeconds || 2) * 1000,
          );
          await enqueueUpload({
            userId: effectiveUid,
            attemptId,
            blob: recordedAudioBlob,
            mimeType: recordedAudioBlob.type || "audio/webm",
            durationMs: effectiveDurationMs,
            mediaId: finalMediaId || mediaId || null,
            attemptToken: attemptToken || undefined,
          });
        }

        focusResultRef.current = true;
        setIsQueued(true);
        setActiveAttemptState(false);
      } else {
        setRunnerAlert(errMsg || "No se pudo completar la entrega");
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

  if (
    isLoading ||
    (runtime?.activity.type === ActivityType.game && isFetching)
  ) {
    return (
      <p role="status" className="origami-state">
        Cargando actividad…
      </p>
    );
  }

  if (!runtime) {
    return (
      <div className="origami-state origami-state--error mx-auto max-w-lg space-y-3">
        <h1 className="origami-page-title">No pudimos abrir la actividad</h1>
        <p className="origami-reading">{error || "Intento no disponible"}</p>
        <Link
          href="/inicio"
          className="origami-button origami-button--secondary"
        >
          Volver al Inicio
        </Link>
      </div>
    );
  }

  const { activity, attempt } = runtime;
  const isFinished =
    completion !== null ||
    isQueued ||
    attempt.status === AttemptStatus.graded ||
    attempt.status === AttemptStatus.pending_review;

  if (isQueued) {
    return (
      <section className="origami-state origami-state--warning mx-auto max-w-[45rem] space-y-4">
        <h1 ref={resultHeadingRef} tabIndex={-1} className="origami-page-title">
          Entrega pendiente de envío
        </h1>
        <p>
          Tu entrega está en cola en este dispositivo. Se enviará al recuperar
          la conexión. Todavía no se ha confirmado la entrega.
        </p>
        <div className={styles.actionBar}>
          <Link href="/inicio" className="origami-button">
            Ir a Mis Misiones
          </Link>
          <Link
            href="/progreso"
            className="origami-button origami-button--secondary"
          >
            Ver Mi Progreso
          </Link>
        </div>
      </section>
    );
  }

  if (completion) {
    const isGame = activity.type === ActivityType.game;
    const score = completion.attempt.score;
    const starsCount = completion.attempt.stars ?? scoreToGameStars(score);
    const heading = isGame
      ? "¡Partida completada!"
      : activity.type === ActivityType.open_question ||
          activity.type === ActivityType.speaking
        ? "¡Actividad entregada con éxito!"
        : "¡Misión completada!";

    return (
      <section className="origami-card origami-card--featured mx-auto max-w-[45rem] space-y-4 [overflow-wrap:anywhere]">
        <h1 ref={resultHeadingRef} tabIndex={-1} className="origami-page-title">
          {heading}
        </h1>

        {isGame ? (
          <>
            <div
              className={styles.stars}
              data-reveal={revealStars || undefined}
              role="img"
              aria-label={`Estrellas de práctica: ${starsCount} de 3`}
              onAnimationEnd={(event) => {
                if (
                  !revealStars ||
                  event.target !== event.currentTarget ||
                  event.pseudoElement
                )
                  return;
                setRevealStars(false);
                if (score != null && score >= 3.0)
                  fireCelebrationConfetti({ theme });
              }}
            >
              {[1, 2, 3].map((star) => (
                <Star
                  key={star}
                  aria-hidden="true"
                  data-earned={star <= starsCount}
                />
              ))}
            </div>
            <p className="origami-reading">
              {completion.attempt.motivationMessage ||
                getGameMotivationMessage(
                  score ?? 0,
                  theme === "teens" ? AgeSegment.teens : AgeSegment.kids,
                )}
            </p>
          </>
        ) : score != null ? (
          <p className="origami-section-title origami-tabular">
            Nota: {score.toFixed(1).replace(".", ",")} / 5,0
          </p>
        ) : (
          <p className="origami-reading">
            Tu respuesta ha quedado registrada. Tu profesora la revisará y
            calificará en los próximos días.
          </p>
        )}

        {completion.correction &&
          Object.keys(completion.correction).length > 0 && (
            <section className="space-y-2">
              <h2 className="origami-section-title">
                Retroalimentación de respuestas:
              </h2>
              <CorrectionFeedback correction={completion.correction} />
            </section>
          )}

        {completion.newBadges && completion.newBadges.length > 0 && (
          <section className="origami-state origami-state--success space-y-3">
            <h2 className="origami-section-title">
              ¡Nueva insignia desbloqueada!
            </h2>
            {completion.newBadges.map((badge) => (
              <div key={badge.id} className="flex items-start gap-3">
                <span aria-hidden="true" className="text-2xl">
                  {renderBadgeIcon(badge.icon)}
                </span>
                <div>
                  <h3 className="origami-card-title">{badge.name}</h3>
                  <p>{badge.description}</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {runnerAlert && (
          <p role="alert" className="origami-state origami-state--error">
            {runnerAlert}
          </p>
        )}
        <div className={styles.actionBar}>
          {isGame && (
            <button
              type="button"
              onClick={handlePlayAgain}
              disabled={playAgainMutation.isPending}
              className="origami-button"
            >
              {playAgainMutation.isPending ? "Iniciando…" : "Jugar de nuevo"}
            </button>
          )}
          <Link
            href="/inicio"
            className={
              isGame
                ? "origami-button origami-button--secondary"
                : "origami-button"
            }
          >
            Ir a Mis Misiones
          </Link>
          <Link
            href="/progreso"
            className="origami-button origami-button--secondary"
          >
            Ver Mi Progreso
          </Link>
        </div>
      </section>
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
  const openQInstructions = parsedOpenQ.success
    ? parsedOpenQ.data.instructions
    : undefined;

  return (
    <div className={styles.practice}>
      {runnerAlert && (
        <div
          role="alert"
          className="origami-state origami-state--error flex flex-wrap items-center justify-between gap-2"
        >
          <span role="alert">{runnerAlert}</span>
          <button
            type="button"
            onClick={() => setRunnerAlert(null)}
            className="origami-button origami-button--text"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* Activity Header Bar */}
      <div className="origami-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="origami-label">Nivel {activity.level}</span>
            <span className="text-xs font-semibold text-[var(--origami-text-secondary)]">
              Intento #{attempt.attemptNumber}
            </span>
            {attempt.status === "in_progress" && attempt.completeUntil && (
              <span className="origami-state origami-state--warning flex flex-wrap items-center gap-1">
                <span aria-hidden="true">⏳</span>
                <span>
                  Termina antes de:{" "}
                  {new Date(attempt.completeUntil).toLocaleDateString("es-CO", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </span>
              </span>
            )}
          </div>
          <h1 className="origami-page-title">{activity.title}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activity.type === ActivityType.game && (
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="origami-button origami-button--secondary"
              title={
                soundEnabled
                  ? "Silenciar efectos de sonido"
                  : "Activar efectos de sonido"
              }
              aria-label={
                soundEnabled
                  ? "Silenciar efectos de sonido"
                  : "Activar efectos de sonido"
              }
            >
              <span aria-hidden="true">{soundEnabled ? "🔊" : "🔇"}</span>
              <span>{soundEnabled ? "Sonido sí" : "Sonido no"}</span>
            </button>
          )}

          {hasTtsSupport && (
            <button
              type="button"
              onClick={() => speakText(activity.title)}
              className="origami-button origami-button--secondary"
              title="Escuchar título"
              aria-label="Escuchar título"
            >
              <span aria-hidden="true">🗣️</span>
              <span>Escuchar</span>
            </button>
          )}
        </div>
      </div>

      {/* Runner Body by Activity Type */}
      <div className="origami-card space-y-6">
        {activity.type === ActivityType.fill_blank && fbConfig?.items && (
          <SentenceRenderer
            items={fbConfig.items}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            disabled={isFinished}
            onSpeak={hasTtsSupport ? speakText : undefined}
          />
        )}

        {activity.type === ActivityType.exam && examConfig?.items && (
          <SentenceRenderer
            exam
            items={examConfig.items}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            disabled={isFinished}
            onSpeak={hasTtsSupport ? speakText : undefined}
          />
        )}

        {activity.type === ActivityType.open_question && (
          <OpenQuestionRenderer
            instructions={openQInstructions}
            items={openQItems}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            disabled={isFinished}
            onSpeak={hasTtsSupport ? speakText : undefined}
          />
        )}

        {activity.type === ActivityType.speaking && (
          <SpeakingRenderer
            prompt={speakingConfig?.prompt}
            onSpeak={hasTtsSupport ? speakText : undefined}
            recorder={
              isFinished
                ? undefined
                : {
                    mode: "attempt",
                    isRecording,
                    recordingSeconds,
                    savedDuration: !recordedAudioBlob
                      ? null
                      : recordingDurationRef.current > 0
                        ? `${recordingDurationRef.current}s`
                        : recordingSeconds > 0
                          ? `${recordingSeconds}s`
                          : "guardada",
                    isUploading: isUploadingAudio,
                    progress: uploadProgress,
                    error: uploadError,
                    onStart: startRecording,
                    onStop: stopRecording,
                    onRetry: () => void uploadAudioRecording(),
                  }
            }
          />
        )}

        {/* Microgame Type (SPEC-06, ENG-080 to ENG-085) */}
        {activity.type === ActivityType.game &&
          isGamePublicConfig(activity.config) && (
            <GameRenderer
              config={activity.config}
              initialState={
                isGameAnswers(runtime.answers) ? runtime.answers : {}
              }
              onEvent={(event) => {
                if ("itemId" in event && "answer" in event) {
                  handleAnswerChange(event.itemId, event.answer);
                }
              }}
              soundEnabled={soundEnabled}
              theme={theme}
              onComplete={(finalAnswers) => {
                handleCompleteAttempt(finalAnswers);
              }}
            />
          )}

        {/* Submit Button for standard activities (Microgames provide their own dedicated submit action) */}
        {!isFinished && activity.type !== ActivityType.game && (
          <div className={styles.actionBar}>
            <button
              type="button"
              disabled={
                isSubmitting ||
                isUploadingAudio ||
                (activity.type === ActivityType.speaking &&
                  (!recordedAudioBlob ||
                    (!mediaId &&
                      (typeof navigator === "undefined" || navigator.onLine))))
              }
              onClick={() => handleCompleteAttempt()}
              className="origami-button"
            >
              {isSubmitting ? "Entregando actividad…" : "Entregar actividad ✨"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
