const BLANK_MARKER_SOURCE = String.raw`\{\{\s*([^}]+?)\s*\}\}|___\[([^\]]+?)\]___`;

/**
 * Reemplaza los marcadores internos de huecos (`{{uuid}}` o `___[uuid]___`)
 * por espacios legibles para el alumno y la previsualización docente.
 */
export function formatBlankPrompt(
  prompt: string,
  blanks?: ReadonlyArray<{ id: string }>,
): string {
  const matches = prompt.match(new RegExp(BLANK_MARKER_SOURCE, 'g'));
  if (!matches || matches.length === 0) {
    return prompt;
  }

  const totalBlanks = Math.max(blanks?.length ?? 0, matches.length);
  let fallbackIndex = 0;

  return prompt.replace(
    new RegExp(BLANK_MARKER_SOURCE, 'g'),
    (_match, curlyId?: string, bracketId?: string) => {
      fallbackIndex += 1;
      if (totalBlanks <= 1) {
        return '_____';
      }
      const tokenId = (curlyId ?? bracketId ?? '').trim();
      const matchedIndex = blanks?.findIndex((b) => b.id === tokenId) ?? -1;
      const displayNumber = matchedIndex >= 0 ? matchedIndex + 1 : fallbackIndex;
      return `_____ (${displayNumber})`;
    },
  );
}

/**
 * Limpia los marcadores de huecos para lectura TTS, evitando pronunciar UUIDs.
 */
export function formatBlankPromptForSpeech(prompt: string): string {
  return prompt
    .replace(new RegExp(BLANK_MARKER_SOURCE, 'g'), ' ... ')
    .replace(/\s+/g, ' ')
    .trim();
}
