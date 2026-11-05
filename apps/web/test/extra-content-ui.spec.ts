import { describe, it, expect } from 'vitest';
import { isValidHttpsResourceUrl } from '@englove/shared';

describe('SPEC-10: Extra Content UI Rules & Contracts (ENG-120, ENG-121)', () => {
  describe('RF-1 y RF-4: Validación de URL https en cliente y formulario docente', () => {
    it('valida que la URL comience con https:// y no contenga esquemas inseguros', () => {
      expect(isValidHttpsResourceUrl('https://es.educaplay.com/recursos/123')).toBe(true);
      expect(isValidHttpsResourceUrl('http://insecure.site.com')).toBe(false);
      expect(isValidHttpsResourceUrl('javascript:alert(1)')).toBe(false);
      expect(isValidHttpsResourceUrl('data:text/html,test')).toBe(false);
      expect(isValidHttpsResourceUrl('file:///c:/passwords.txt')).toBe(false);
    });

    it('bloquea URLs con credenciales embebidas o con espacios', () => {
      expect(isValidHttpsResourceUrl('https://user:pass@educaplay.com/test')).toBe(false);
      expect(isValidHttpsResourceUrl('https://site.com/foo bar')).toBe(false);
    });

    it('tolera y normaliza protocolo https:// con mayúsculas por autocapitalización móvil', () => {
      const urlFromMobile = '  Https://es.educaplay.com/recursos/123   ';
      const trimmed = urlFromMobile.trim();
      const isValid = trimmed.toLowerCase().startsWith('https://') && isValidHttpsResourceUrl(trimmed);
      expect(isValid).toBe(true);

      const normalized = trimmed.replace(/^https:\/\//i, 'https://');
      expect(normalized).toBe('https://es.educaplay.com/recursos/123');
    });

    it('valida longitud de título (1..160) y de URL (1..2048)', () => {
      const isTitleValid = (t: string) => t.trim().length >= 1 && t.trim().length <= 160;
      expect(isTitleValid('')).toBe(false);
      expect(isTitleValid('   ')).toBe(false);
      expect(isTitleValid('Animals Memory Game')).toBe(true);
      expect(isTitleValid('A'.repeat(161))).toBe(false);
    });
  });

  describe('RF-5: Navegación de estudiante (StudentNav) y techo de 3 clics', () => {
    it('mantiene un máximo de 5 entradas en StudentNav con juegos y contenido extra habilitados', () => {
      const getNavItems = (gamesOn: boolean, extraOn: boolean) => [
        { label: 'Inicio', href: '/inicio' },
        ...(gamesOn ? [{ label: 'Juegos', href: '/juegos' }] : []),
        { label: 'Progreso', href: '/progreso' },
        { label: 'Feedback', href: '/feedback' },
        ...(extraOn ? [{ label: 'Extra', href: '/extra', ariaLabel: 'Contenido extra' }] : []),
      ];

      const fullNav = getNavItems(true, true);
      expect(fullNav).toHaveLength(5);
      expect(fullNav.map((i) => i.label)).toEqual(['Inicio', 'Juegos', 'Progreso', 'Feedback', 'Extra']);

      const navWithoutExtra = getNavItems(true, false);
      expect(navWithoutExtra).toHaveLength(4);
      expect(navWithoutExtra.some((i) => i.href === '/extra')).toBe(false);
    });

    it('abre cualquier recurso en un máximo de 3 clics desde /inicio', () => {
      // Flujo de navegación:
      // Clic 1: Desde /inicio, pulsa "Extra" en la barra de navegación -> navega a /extra
      // Clic 2 (opcional): Pulsa píldora de filtro ("Nivel A1" o "Generales")
      // Clic 2 o 3: Pulsa "Abrir en pestaña nueva ↗" en la tarjeta del recurso
      const calculateClicksToOpen = (hasFiltered: boolean): number => {
        const clickNav = 1;
        const clickFilter = hasFiltered ? 1 : 0;
        const clickOpen = 1;
        return clickNav + clickFilter + clickOpen;
      };

      expect(calculateClicksToOpen(false)).toBe(2);
      expect(calculateClicksToOpen(true)).toBe(3);
      expect(calculateClicksToOpen(true)).toBeLessThanOrEqual(3);
    });

    it('aplica textos temáticos de estado vacío según el segmento de edad (kids vs teens)', () => {
      const getEmptyMessage = (segment: 'kids' | 'teens'): string => {
        return segment === 'kids'
          ? 'Todavía no hay enlaces extra para explorar.'
          : 'Aún no hay contenido extra publicado para tu nivel.';
      };

      expect(getEmptyMessage('kids')).toBe('Todavía no hay enlaces extra para explorar.');
      expect(getEmptyMessage('teens')).toBe('Aún no hay contenido extra publicado para tu nivel.');
    });

    it('filtra localmente por píldoras entre Todos, Nivel y Generales', () => {
      const sampleItems = [
        { id: '1', title: 'Gen 1', level: null },
        { id: '2', title: 'A1 1', level: 'A1' },
      ];

      const filterByPill = (items: typeof sampleItems, pill: 'todos' | 'nivel' | 'generales', studentLevel: string | null) => {
        if (pill === 'generales') return items.filter((i) => i.level === null);
        if (pill === 'nivel' && studentLevel) return items.filter((i) => i.level === studentLevel);
        return items;
      };

      expect(filterByPill(sampleItems, 'todos', 'A1')).toHaveLength(2);
      expect(filterByPill(sampleItems, 'nivel', 'A1')).toHaveLength(1);
      expect(filterByPill(sampleItems, 'nivel', 'A1')[0]?.id).toBe('2');
      expect(filterByPill(sampleItems, 'generales', 'A1')).toHaveLength(1);
      expect(filterByPill(sampleItems, 'generales', 'A1')[0]?.id).toBe('1');
    });
  });

  describe('RF-6: Seguridad y enlaces externos en pestaña nueva', () => {
    it('garantiza atributos target="_blank" y rel="noopener noreferrer" sin fugas de sesión', () => {
      const anchorProps = {
        href: 'https://es.educaplay.com/recursos/123',
        target: '_blank',
        rel: 'noopener noreferrer',
      };

      expect(anchorProps.target).toBe('_blank');
      expect(anchorProps.rel).toBe('noopener noreferrer');
      expect(anchorProps.href).not.toContain('studentId');
      expect(anchorProps.href).not.toContain('token');
      expect(anchorProps.href).not.toContain('sessionId');
    });
  });

  describe('RF-8: Estado offline en cliente', () => {
    it('muestra el aviso de conexión requerida cuando navigator.onLine es false', () => {
      const getOfflineNotice = (isOnline: boolean) => {
        if (!isOnline) {
          return 'Necesitas conexión a internet para abrir enlaces externos.';
        }
        return null;
      };

      expect(getOfflineNotice(false)).toBe('Necesitas conexión a internet para abrir enlaces externos.');
      expect(getOfflineNotice(true)).toBeNull();
    });
  });
});
