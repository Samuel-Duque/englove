import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { scoreToStars } from '@englove/shared';
import { StudentNav } from '../src/components/student-nav';

vi.mock('next/navigation', () => ({usePathname: () => '/inicio'}));

describe('QA-01 / SPEC-05 RF-1: navegación productiva del alumno', () => {
  it.each([[false, false], [true, false], [false, true], [true, true]])(
    'renderiza las rutas reales según flags (juegos=%s, extra=%s)', (gamesEnabled, extraContentEnabled) => {
      const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
      const html = renderToStaticMarkup(createElement(QueryClientProvider, {client},
        createElement(StudentNav, {studentName: 'Alumno', gamesEnabled, extraContentEnabled})));
      const routes = new Set([...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]));
      expect(routes.has('/inicio')).toBe(true);
      expect(routes.has('/progreso')).toBe(true);
      expect(routes.has('/feedback')).toBe(true);
      expect(routes.has('/perfil')).toBe(true);
      expect(routes.has('/juegos')).toBe(gamesEnabled);
      expect(routes.has('/extra')).toBe(extraContentEnabled);
      expect(routes.size - 1).toBeLessThanOrEqual(5);
      for (const teacherRoute of ['/alumnos', '/actividades', '/grupos']) expect(routes.has(teacherRoute)).toBe(false);
      client.clear();
    },
  );
});

describe('SPEC-05: conversión productiva de nota a estrellas (Decisión 101)', () => {
  it.each([[0, 0], [null, 0], [undefined, 0], [1, 1], [2.9, 1], [3, 2], [4.4, 2], [4.5, 3], [5, 3]])(
    'score=%s → %s estrellas', (score, stars) => expect(scoreToStars(score)).toBe(stars),
  );
});
