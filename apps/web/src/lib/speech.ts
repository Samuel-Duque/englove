const spanish = /[áéíóúñ¿¡]|\b(selecciona|completa|escucha|arrastra|responde|elige|traduce|escribe|une|haz|marca|graba|pregunta)\b/i;

export function speechSegments(text: string): Array<{ text: string; lang: 'es-CO' | 'en-US' }> {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const colon = trimmed.indexOf(':');
  if (colon >= 0) {
    const prefix = trimmed.slice(0, colon + 1).trim();
    const suffix = trimmed.slice(colon + 1).trim();
    if (suffix && spanish.test(prefix) && !spanish.test(suffix)) {
      return [{ text: prefix, lang: 'es-CO' }, { text: suffix, lang: 'en-US' }];
    }
  }
  return [{ text: trimmed, lang: spanish.test(trimmed) ? 'es-CO' : 'en-US' }];
}

export function speak(text: string, onEnd?: () => void) {
  const segments = speechSegments(text);
  window.speechSynthesis.cancel();
  segments.forEach((segment, index) => {
    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.lang = segment.lang;
    utterance.rate = 0.85;
    if (index === segments.length - 1) {
      utterance.onend = () => onEnd?.();
      utterance.onerror = () => onEnd?.();
    }
    window.speechSynthesis.speak(utterance);
  });
}
