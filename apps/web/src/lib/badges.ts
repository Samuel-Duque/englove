export function renderBadgeIcon(icon?: string | null): string {
  if (!icon) return '🏅';
  const map: Record<string, string> = {
    star: '⭐',
    mic: '🎙️',
    flame: '🔥',
    trophy: '🏆',
    crown: '👑',
    medal: '🏅',
    rocket: '🚀',
    heart: '❤️',
    book: '📖',
    target: '🎯',
    zap: '⚡',
  };
  return map[icon.toLowerCase()] || icon;
}
