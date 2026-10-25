/**
 * Sound effects engine for microgames using native Web Audio API synthesis (SPEC-06 RF-9, ENG-086, Decisión 107).
 * Synthesizes procedural effects for 'hit', 'miss', and 'complete' with zero external assets or network latency.
 * Degrades gracefully without errors if browser blocks autoplay or audio context is unavailable.
 */

export type SoundEvent = 'hit' | 'miss' | 'complete';

class SoundManager {
  private audioContext: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.audioContext = new AudioCtx();
        } catch {
          this.audioContext = null;
        }
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  play(event: SoundEvent, soundEnabled: boolean = true): void {
    if (!soundEnabled || typeof window === 'undefined') return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (event === 'hit') {
        // High, cheerful ascending chime (C5 -> E5)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.25);
      } else if (event === 'miss') {
        // Low, gentle descending buzz (D3 -> B2)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(164.81, now); // E3
        osc.frequency.linearRampToValueAtTime(130.81, now + 0.18); // C3

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.22);
      } else if (event === 'complete') {
        // Joyful 3-tone victory chord (C5 -> G5 -> C6)
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const noteStart = now + idx * 0.08;

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, noteStart);

          gain.gain.setValueAtTime(0.15, noteStart);
          gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(noteStart);
          osc.stop(noteStart + 0.35);
        });
      }
    } catch {
      // Audio playback fails safely without throwing uncaught errors
    }
  }
}

export const soundManager = new SoundManager();

export function playSound(event: SoundEvent, soundEnabled: boolean = true): void {
  soundManager.play(event, soundEnabled);
}
