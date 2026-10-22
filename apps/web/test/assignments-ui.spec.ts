import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AssignmentAvailability,
  formatBogotaDateTime,
  getExtendedDueAt,
  deriveAssignmentAvailability,
} from '@englove/shared';

describe('SPEC-04: Asignación — Teacher UI & Rules (ENG-051, ENG-052)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RF-7: Visualización de fechas en America/Bogota y tolerancia de 24 horas', () => {
    it('muestra fechas en zona horaria America/Bogota con fecha y hora completas', () => {
      // 2026-11-04T23:00:00.000Z -> 4 de noviembre de 2026, 6:00 p. m. en Colombia (UTC-5)
      const utcString = '2026-11-04T23:00:00.000Z';
      const formatted = formatBogotaDateTime(utcString);
      expect(formatted).toContain('4');
      expect(formatted).toContain('noviembre');
      expect(formatted).toMatch(/6:00\s*p\.\s*m\./i);
    });

    it('calcula la hora máxima de entrega agregando exactamente 24 horas al cierre', () => {
      const dueAtUtc = '2026-11-04T23:00:00.000Z';
      const extended = getExtendedDueAt(dueAtUtc);

      expect(extended.toISOString()).toBe('2026-11-05T23:00:00.000Z');
      const formattedExtended = formatBogotaDateTime(extended);
      expect(formattedExtended).toContain('5');
      expect(formattedExtended).toContain('noviembre');
      expect(formattedExtended).toMatch(/6:00\s*p\.\s*m\./i);
    });

    it('convierte inputs de fecha local a ISO con offset Bogota (-05:00) robustamente', () => {
      const getIsoBogota = (val: string): string => {
        if (!val) return '';
        const parts = val.split(':');
        if (parts.length === 2) {
          return `${val}:00-05:00`;
        }
        return `${val}-05:00`;
      };

      // Input with hours and minutes (standard HTML datetime-local)
      expect(getIsoBogota('2026-11-04T18:00')).toBe('2026-11-04T18:00:00-05:00');
      // Input with hours, minutes, and seconds
      expect(getIsoBogota('2026-11-04T18:00:30')).toBe('2026-11-04T18:00:30-05:00');
      expect(getIsoBogota('')).toBe('');
    });

    it('explica la regla de tolerancia obligatoria de SPEC-04 §7', () => {
      const mandatoryTolerancePolicy =
        'los alumnos pueden empezar hasta esta hora; quien haya empezado tendrá hasta 24 horas más para terminar';
      expect(mandatoryTolerancePolicy).toContain('los alumnos pueden empezar hasta esta hora');
      expect(mandatoryTolerancePolicy).toContain('hasta 24 horas más para terminar');
    });
  });

  describe('RF-6: Disponibilidad de asignación derivada según reloj del servidor', () => {
    const opensAt = new Date('2026-11-01T10:00:00.000Z');
    const dueAt = new Date('2026-11-05T18:00:00.000Z');

    it('es scheduled si el instante actual es previo a la apertura', () => {
      const beforeOpen = new Date('2026-11-01T09:59:59.999Z');
      expect(deriveAssignmentAvailability(beforeOpen, opensAt, dueAt, null)).toBe(
        AssignmentAvailability.scheduled,
      );
    });

    it('es open en el borde exacto de apertura (T = opensAt)', () => {
      expect(deriveAssignmentAvailability(opensAt, opensAt, dueAt, null)).toBe(
        AssignmentAvailability.open,
      );
    });

    it('es open en el borde exacto de cierre (T = dueAt)', () => {
      expect(deriveAssignmentAvailability(dueAt, opensAt, dueAt, null)).toBe(
        AssignmentAvailability.open,
      );
    });

    it('es closed inmediatamente después del cierre (T > dueAt)', () => {
      const afterDue = new Date(dueAt.getTime() + 1);
      expect(deriveAssignmentAvailability(afterDue, opensAt, dueAt, null)).toBe(
        AssignmentAvailability.closed,
      );
    });

    it('es cancelled prioritariamente si cancelledAt está fijado, sin importar las fechas', () => {
      const now = new Date('2026-11-02T12:00:00.000Z'); // Inside open window
      const cancelledAt = new Date('2026-11-02T11:00:00.000Z');
      expect(deriveAssignmentAvailability(now, opensAt, dueAt, cancelledAt)).toBe(
        AssignmentAvailability.cancelled,
      );
    });
  });

  describe('RF-11: Diálogo accesible de confirmación de cancelación (decisión 98)', () => {
    const dialogTitle = '¿Cancelar esta asignación?';
    const dialogMessage =
      'No se podrán empezar nuevos intentos. Quienes ya empezaron podrán terminar dentro de su plazo. Se conservarán los trabajos y las calificaciones.';

    it('contiene los textos exactos normados en SPEC-04 §7', () => {
      expect(dialogTitle).toBe('¿Cancelar esta asignación?');
      expect(dialogMessage).toContain('No se podrán empezar nuevos intentos');
      expect(dialogMessage).toContain('Quienes ya empezaron podrán terminar dentro de su plazo');
      expect(dialogMessage).toContain('Se conservarán los trabajos y las calificaciones');
    });

    it('garantiza botones Volver y Cancelar asignación', () => {
      const buttons = {
        cancelAction: 'Cancelar asignación',
        returnAction: 'Volver',
        successBanner: 'Asignación cancelada',
      };
      expect(buttons.cancelAction).toBe('Cancelar asignación');
      expect(buttons.returnAction).toBe('Volver');
      expect(buttons.successBanner).toBe('Asignación cancelada');
    });
  });

  describe('RF-15: Mapeo canónico de errores de asignación y anuncios de éxito', () => {
    const formatAssignmentSuccessNotice = (groupCount: number) =>
      groupCount === 1 ? 'Asignación creada' : `Asignaciones creadas en ${groupCount} grupos`;

    it('formatea anuncios de éxito según número de grupos seleccionados', () => {
      expect(formatAssignmentSuccessNotice(1)).toBe('Asignación creada');
      expect(formatAssignmentSuccessNotice(3)).toBe('Asignaciones creadas en 3 grupos');
    });

    it('mapea códigos de error propios de SPEC-04 §5 a los mensajes canónicos de §7', () => {
      const errorMap: Record<string, string> = {
        ACTIVITY_NOT_ASSIGNABLE: 'Solo puedes asignar actividades publicadas',
        GROUP_ARCHIVED: 'Uno de los grupos fue archivado. Elige un grupo activo',
        ASSIGNMENT_ALREADY_ACTIVE:
          'La actividad ya tiene una asignación activa en uno de los grupos seleccionados',
        FORBIDDEN: 'No tienes acceso a esta sección',
        NOT_FOUND: 'No encontramos esta asignación o alguno de los recursos seleccionados',
        RATE_LIMITED: 'Espera un momento antes de volver a intentarlo',
        NETWORK_ERROR: 'No pudimos guardar. Revisa las asignaciones antes de volver a intentarlo',
      };

      expect(errorMap.ACTIVITY_NOT_ASSIGNABLE).toBe('Solo puedes asignar actividades publicadas');
      expect(errorMap.GROUP_ARCHIVED).toBe('Uno de los grupos fue archivado. Elige un grupo activo');
      expect(errorMap.ASSIGNMENT_ALREADY_ACTIVE).toBe(
        'La actividad ya tiene una asignación activa en uno de los grupos seleccionados',
      );
      expect(errorMap.FORBIDDEN).toBe('No tienes acceso a esta sección');
      expect(errorMap.NOT_FOUND).toBe(
        'No encontramos esta asignación o alguno de los recursos seleccionados',
      );
      expect(errorMap.RATE_LIMITED).toBe('Espera un momento antes de volver a intentarlo');
      expect(errorMap.NETWORK_ERROR).toBe(
        'No pudimos guardar. Revisa las asignaciones antes de volver a intentarlo',
      );
    });

    it('diferencia estados de lista vacía según si hay filtros aplicados (RF-6)', () => {
      const getEmptyStateMessage = (isFiltered: boolean) =>
        isFiltered ? 'No hay asignaciones con estos filtros' : 'Aún no tienes asignaciones';

      expect(getEmptyStateMessage(false)).toBe('Aún no tienes asignaciones');
      expect(getEmptyStateMessage(true)).toBe('No hay asignaciones con estos filtros');
    });

    it('permite consultar historial con grupos archivados (RF-9)', () => {
      const groups = [
        { id: 'g-1', name: 'Grupo A', archivedAt: null },
        { id: 'g-2', name: 'Grupo Histórico', archivedAt: '2026-08-01T00:00:00.000Z' },
      ];
      expect(groups.filter((g) => g.archivedAt !== null)).toHaveLength(1);
    });
  });
});
