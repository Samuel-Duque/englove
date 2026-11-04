export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  fill_blank: '✍️ Espacios',
  speaking: '🎙️ Speaking',
  game: '🎮 Minijuego',
  exam: '📝 Examen',
  open_question: '📄 Pregunta',
};

export function getActivityTypeLabel(type: string): string {
  return ACTIVITY_TYPE_LABELS[type] || '📄 Actividad';
}
