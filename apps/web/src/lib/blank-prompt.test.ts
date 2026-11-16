import { describe, expect, it } from 'vitest';
import { formatBlankPrompt, formatBlankPromptForSpeech } from './blank-prompt';

describe('blank-prompt (ERR-01)', () => {
  it('reemplaza el marcador canónico {{uuid}} de un hueco único por _____', () => {
    expect(
      formatBlankPrompt('I {{22222222-2222-4222-8222-222222222601}} happy.', [
        { id: '22222222-2222-4222-8222-222222222601' },
      ]),
    ).toBe('I _____ happy.');
  });

  it('reemplaza el marcador ___ [uuid] ___ observado en Midterm Exam A1 por _____', () => {
    expect(
      formatBlankPrompt('She ___[78cf4a17-baaa-4eb1-9bb4-cae449ef960d]___ English fluently.', [
        { id: '78cf4a17-baaa-4eb1-9bb4-cae449ef960d' },
      ]),
    ).toBe('She _____ English fluently.');
  });

  it('numera los huecos según su posición en blanks cuando hay múltiples espacios', () => {
    const prompt =
      'Yesterday {{b2}} went to {{b1}} school.';
    const blanks = [{ id: 'b1' }, { id: 'b2' }];
    expect(formatBlankPrompt(prompt, blanks)).toBe(
      'Yesterday _____ (2) went to _____ (1) school.',
    );
  });

  it('deja intactos los prompts sin marcadores de hueco', () => {
    expect(formatBlankPrompt('Write a short paragraph about your pet.')).toBe(
      'Write a short paragraph about your pet.',
    );
  });

  it('limpia marcadores de huecos para TTS sin pronunciar UUIDs', () => {
    expect(
      formatBlankPromptForSpeech(
        'She ___[78cf4a17-baaa-4eb1-9bb4-cae449ef960d]___ English fluently.',
      ),
    ).toBe('She ... English fluently.');
    expect(
      formatBlankPromptForSpeech('I {{22222222-2222-4222-8222-222222222601}} happy.'),
    ).toBe('I ... happy.');
  });
});
