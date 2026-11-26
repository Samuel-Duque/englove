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
      ? ['#C6470B', '#FFCA3A', '#B9251D', '#2B150A', '#166534']
      : ['#C6470B', '#FFCA3A', '#B9251D', '#2B150A'];

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
