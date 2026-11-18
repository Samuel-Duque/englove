"use client";

import React, { useEffect, useState } from "react";
import { RotateCcw, WifiOff } from "lucide-react";
import { SystemSheet } from "../origami-system-sheet";
import {
  resolveUserSegment,
  isTeensOrTeacherSegment,
  USER_SEGMENT_EVENT,
} from "../../lib/user-segment";

export function OfflineClient() {
  const [isTeensOrTeacher, setIsTeensOrTeacher] = useState(() =>
    isTeensOrTeacherSegment(resolveUserSegment()),
  );

  useEffect(() => {
    const updateSegment = () => {
      const segment = resolveUserSegment();
      setIsTeensOrTeacher(isTeensOrTeacherSegment(segment));
    };

    updateSegment();

    window.addEventListener("storage", updateSegment);
    window.addEventListener(USER_SEGMENT_EVENT, updateSegment);
    return () => {
      window.removeEventListener("storage", updateSegment);
      window.removeEventListener(USER_SEGMENT_EVENT, updateSegment);
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  const effectiveTeensOrTeacher =
    isTeensOrTeacher || isTeensOrTeacherSegment(resolveUserSegment());

  return (
    <SystemSheet
      title={effectiveTeensOrTeacher ? "Sin conexión" : "¡Ups! No hay internet"}
      description={
        effectiveTeensOrTeacher
          ? "Sin conexión. Revisa tu red e inténtalo de nuevo."
          : "¡Ups! No hay internet. Revisa la conexión y vuelve a intentarlo."
      }
      icon={<WifiOff />}
      variant="warning"
    >
      <button type="button" onClick={handleRetry} className="origami-button">
        <RotateCcw aria-hidden="true" />
        Reintentar
      </button>
    </SystemSheet>
  );
}
