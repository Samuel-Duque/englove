import confetti from 'canvas-confetti';

export interface ConfettiOptions {
  theme?: 'kids' | 'teens';
}

/**
 * Fires celebration confetti respecting user motion preferences and theme palettes (SPEC-06 RF-9).
 */
export function fireCelebrationConfetti(options: ConfettiOptions = {}): void {
  if (typeof window === 'undefined') return;

  // Respect prefers-reduced-motion
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mediaQuery.matches) {
    return;
  }

  const theme = options.theme || 'kids';

  const colors =
    theme === 'kids'
      ? ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6']
      : ['#6366f1', '#a855f7', '#ec4899', '#3b82f6'];

  try {
    confetti({
      particleCount: theme === 'kids' ? 70 : 45,
      spread: 60,
      origin: { y: 0.65 },
      colors,
      disableForReducedMotion: true,
    });
  } catch {
    // Fail silently if canvas-confetti cannot render
  }
}
