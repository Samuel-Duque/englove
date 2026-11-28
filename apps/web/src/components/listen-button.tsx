'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { speak } from '../lib/speech';

let stopPlayback: (() => void) | undefined;

function hasVoices() {
  return typeof window !== 'undefined' &&
    typeof window.SpeechSynthesisUtterance === 'function' &&
    Boolean(window.speechSynthesis?.getVoices().length);
}

function subscribeVoices(onChange: () => void) {
  const synthesis = window.speechSynthesis;
  synthesis?.addEventListener('voiceschanged', onChange);
  return () => synthesis?.removeEventListener('voiceschanged', onChange);
}

export function ListenButton({ text }: { text: string }) {
  const available = useSyncExternalStore(subscribeVoices, hasVoices, () => false);
  const [playing, setPlaying] = useState(false);
  const ownPlayback = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    const stop = ownPlayback.current;
    if (stop && stopPlayback === stop) {
      stopPlayback = undefined;
      ownPlayback.current = null;
      window.speechSynthesis.cancel();
    }
  }, []);

  if (!available || !text.trim()) return null;

  const toggle = () => {
    if (playing) {
      ownPlayback.current?.();
      return;
    }
    stopPlayback?.();
    const finish = () => {
      if (ownPlayback.current !== stop) return;
      ownPlayback.current = null;
      if (stopPlayback === stop) stopPlayback = undefined;
      setPlaying(false);
    };
    const stop = () => {
      finish();
      window.speechSynthesis.cancel();
    };
    ownPlayback.current = stop;
    stopPlayback = stop;
    setPlaying(true);
    speak(text, finish);
  };

  return (
    <button
      type="button"
      className="kids-button size-12 shrink-0 !p-0"
      data-tone={playing ? 'red' : 'yellow'}
      aria-label={`${playing ? 'Detener' : 'Escuchar'}: ${text}`}
      aria-pressed={playing}
      onClick={toggle}
    >
      {playing ? <Square size={20} aria-hidden="true" /> : <Volume2 size={22} aria-hidden="true" />}
    </button>
  );
}
