'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Clock, Info, X } from 'lucide-react';
import {
  ActivityListResponse,
  ActivityListResponseSchema,
  ActivityType,
  ActivityStatus,
  CreateAssignmentInput,
  Level,
  GroupListResponse,
  GroupListResponseSchema,
  CreateAssignmentResponse,
  CreateAssignmentResponseSchema,
  formatBogotaDateTime,
  getExtendedDueAt,
} from '@upward-english/shared';
import { ErrorState } from '../../../../components/error-state';
import { apiFetch, ApiError } from '../../../../lib/api';
import styles from './nueva-asignacion.module.css';

const typeLabels: Record<ActivityType, string> = {
  [ActivityType.fill_blank]: 'Completar espacios',
  [ActivityType.open_question]: 'Pregunta abierta',
  [ActivityType.speaking]: 'Expresión oral (Speaking)',
  [ActivityType.game]: 'Microjuego',
  [ActivityType.exam]: 'Examen',
};

interface FieldErrors {
  activity?: string;
  groups?: string;
  opensAt?: string;
  dueAt?: string;
}

// Convert datetime-local (Bogota wall-clock time) to ISO-8601 string with -05:00 offset
function getIsoBogota(val: string): string {
  if (!val) return '';
  const parts = val.split(':');
  if (parts.length === 2) {
    return `${val}:00-05:00`;
  }
  return `${val}-05:00`;
}

function formatBogotaInputPreview(val: string): string | null {
  if (!val) return null;
  const iso = getIsoBogota(val);
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  try {
    return formatBogotaDateTime(parsed);
  } catch {
    return null;
  }
}

function computeDefaultBogotaWindow(): { opensAt: string; dueAt: string } {
  const now = new Date();
  const bogotaNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const tomorrow = new Date(bogotaNow);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const nextWeek = new Date(bogotaNow);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

  const y1 = tomorrow.getUTCFullYear();
  const m1 = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
  const d1 = String(tomorrow.getUTCDate()).padStart(2, '0');

  const y2 = nextWeek.getUTCFullYear();
  const m2 = String(nextWeek.getUTCMonth() + 1).padStart(2, '0');
  const d2 = String(nextWeek.getUTCDate()).padStart(2, '0');

  return {
    opensAt: `${y1}-${m1}-${d1}T08:00`,
    dueAt: `${y2}-${m2}-${d2}T18:00`,
  };
}

export function NuevaAsignacionClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const activitiesQuery = useQuery({
    queryKey: ['teacher', 'activities', 'published'],
    queryFn: ({ signal }) =>
      apiFetch<ActivityListResponse>(
        `/api/v1/activities?status=${ActivityStatus.published}&limit=100`,
        { schema: ActivityListResponseSchema, signal },
      ),
  });

  const groupsQuery = useQuery({
    queryKey: ['teacher', 'groups', 'active'],
    queryFn: ({ signal }) =>
      apiFetch<GroupListResponse>('/api/v1/groups?archived=false&limit=100', {
        schema: GroupListResponseSchema,
        signal,
      }),
  });

  const activities = useMemo(() => {
    return (activitiesQuery.data?.items ?? []).filter((a) => a.type !== ActivityType.game);
  }, [activitiesQuery.data]);

  const groups = groupsQuery.data?.items ?? [];
  const isLoading = activitiesQuery.isLoading || groupsQuery.isLoading;
  const loadError =
    (activitiesQuery.error instanceof ApiError
      ? activitiesQuery.error.message
      : activitiesQuery.error instanceof Error
        ? activitiesQuery.error.message
        : null) ||
    (groupsQuery.error instanceof ApiError
      ? groupsQuery.error.message
      : groupsQuery.error instanceof Error
        ? groupsQuery.error.message
        : null);

  // Form selection state
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [opensAtInput, setOpensAtInput] = useState<string>(() => computeDefaultBogotaWindow().opensAt);
  const [dueAtInput, setDueAtInput] = useState<string>(() => computeDefaultBogotaWindow().dueAt);

  // Filters for activity selector
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Submit, field validation & focus management
  const [formError, setFormError] = useState<string | null>(null);
  const [errorFocusSeq, setErrorFocusSeq] = useState<number>(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [opensEdited, setOpensEdited] = useState<boolean>(false);
  const [dueEdited, setDueEdited] = useState<boolean>(false);
  const [politeAnnouncement, setPoliteAnnouncement] = useState<string>('');
  const errorAlertRef = useRef<HTMLDivElement | null>(null);

  const showError = (msg: string) => {
    setFormError(msg);
    setErrorFocusSeq((n) => n + 1);
  };

  useEffect(() => {
    if (errorFocusSeq > 0 && formError) {
      errorAlertRef.current?.focus();
      errorAlertRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [errorFocusSeq, formError]);

  const createMutation = useMutation({
    mutationFn: (body: CreateAssignmentInput) =>
      apiFetch<CreateAssignmentResponse>('/api/v1/assignments', {
        method: 'POST',
        body: JSON.stringify(body),
        schema: CreateAssignmentResponseSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'assignments'] });
      const count = selectedGroupIds.length;
      const msg =
        count === 1
          ? 'Asignación creada'
          : `Asignaciones creadas en ${count} grupos`;
      router.push(`/asignaciones?notice=${encodeURIComponent(msg)}`);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.code === 'ASSIGNMENT_ALREADY_ACTIVE') {
          void queryClient.invalidateQueries({ queryKey: ['teacher', 'assignments'] });
          showError(
            'La actividad ya tiene una asignación activa en uno de los grupos seleccionados',
          );
        } else if (err.code === 'GAME_ASSIGNMENT_NOT_ALLOWED') {
          showError(
            'Los microjuegos están abiertos a todos los alumnos y no se asignan a grupos',
          );
        } else if (err.code === 'ACTIVITY_NOT_ASSIGNABLE') {
          void activitiesQuery.refetch();
          showError('Solo puedes asignar actividades publicadas');
        } else if (err.code === 'GROUP_ARCHIVED') {
          void groupsQuery.refetch();
          showError('Uno de los grupos fue archivado. Elige un grupo activo');
        } else if (err.statusCode === 403) {
          showError('No tienes acceso a esta sección');
        } else if (err.statusCode === 404) {
          showError(
            'No encontramos esta asignación o alguno de los recursos seleccionados',
          );
        } else if (err.statusCode === 429) {
          showError('Espera un momento antes de volver a intentarlo');
        } else {
          showError(
            err.message ||
              'No pudimos guardar. Revisa las asignaciones antes de volver a intentarlo',
          );
        }
      } else {
        showError(
          'No pudimos guardar. Revisa las asignaciones antes de volver a intentarlo',
        );
      }
    },
  });

  const isSubmitting = createMutation.isPending;

  // Filter assignable activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (levelFilter !== 'all' && act.level !== levelFilter) return false;
      if (typeFilter !== 'all' && act.type !== typeFilter) return false;
      return true;
    });
  }, [activities, levelFilter, typeFilter]);

  const selectedActivity = useMemo(() => {
    return activities.find((a) => a.id === selectedActivityId) || null;
  }, [activities, selectedActivityId]);

  const selectedGroups = useMemo(() => {
    return groups.filter((g) => selectedGroupIds.includes(g.id));
  }, [groups, selectedGroupIds]);

  const handleActivitySelect = (activityId: string) => {
    setSelectedActivityId(activityId);
    setFieldErrors((prev) => ({ ...prev, activity: undefined }));
  };

  const handleGroupToggle = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
    setFieldErrors((prev) => ({ ...prev, groups: undefined }));
  };

  const handleSelectAllGroups = () => {
    if (selectedGroupIds.length === groups.length) {
      setSelectedGroupIds([]);
    } else {
      setSelectedGroupIds(groups.map((g) => g.id));
      setFieldErrors((prev) => ({ ...prev, groups: undefined }));
    }
  };

  const opensAtPreview = useMemo(
    () => formatBogotaInputPreview(opensAtInput),
    [opensAtInput],
  );
  const dueAtPreview = useMemo(
    () => formatBogotaInputPreview(dueAtInput),
    [dueAtInput],
  );

  const extendedDueAtText = useMemo(() => {
    if (!dueAtInput) return null;
    const iso = getIsoBogota(dueAtInput);
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return null;
    try {
      const ext = getExtendedDueAt(parsed);
      return formatBogotaDateTime(ext);
    } catch {
      return null;
    }
  }, [dueAtInput]);

  const validateDatePairOnBlur = (target: 'opensAt' | 'dueAt') => {
    const edited = target === 'opensAt' ? opensEdited : dueEdited;
    if (!edited) return;

    const currentVal = target === 'opensAt' ? opensAtInput : dueAtInput;
    if (!currentVal) {
      const msg = 'Revisa la fecha y la hora';
      setFieldErrors((prev) => ({ ...prev, [target]: msg }));
      setPoliteAnnouncement(
        `${target === 'opensAt' ? 'Apertura' : 'Cierre para empezar'}: ${msg}`,
      );
      return;
    }

    if (opensAtInput && dueAtInput) {
      const opensDate = new Date(getIsoBogota(opensAtInput));
      const dueDate = new Date(getIsoBogota(dueAtInput));
      if (Number.isNaN(opensDate.getTime()) || Number.isNaN(dueDate.getTime())) {
        const msg = 'Revisa la fecha y la hora';
        setFieldErrors((prev) => ({ ...prev, [target]: msg }));
        setPoliteAnnouncement(
          `${target === 'opensAt' ? 'Apertura' : 'Cierre para empezar'}: ${msg}`,
        );
        return;
      }
      if (opensDate.getTime() >= dueDate.getTime()) {
        const msg = 'La apertura debe ser anterior al cierre';
        setFieldErrors((prev) => ({ ...prev, dueAt: msg }));
        setPoliteAnnouncement(`Cierre para empezar: ${msg}`);
      } else {
        setFieldErrors((prev) => ({ ...prev, opensAt: undefined, dueAt: undefined }));
        setPoliteAnnouncement('');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setFormError(null);

    if (!selectedActivityId) {
      const msg = 'Por favor selecciona una actividad';
      setFieldErrors({ activity: msg });
      showError(msg);
      return;
    }

    if (selectedGroupIds.length === 0) {
      const msg = 'Por favor selecciona al menos un grupo';
      setFieldErrors({ groups: msg });
      showError(msg);
      return;
    }

    if (!opensAtInput || !dueAtInput) {
      const msg = 'Revisa la fecha y la hora';
      setFieldErrors({
        opensAt: !opensAtInput ? msg : undefined,
        dueAt: !dueAtInput ? msg : undefined,
      });
      showError(msg);
      return;
    }

    const opensAtIso = getIsoBogota(opensAtInput);
    const dueAtIso = getIsoBogota(dueAtInput);
    const opensDate = new Date(opensAtIso);
    const dueDate = new Date(dueAtIso);

    if (Number.isNaN(opensDate.getTime()) || Number.isNaN(dueDate.getTime())) {
      const msg = 'Revisa la fecha y la hora';
      setFieldErrors({
        opensAt: Number.isNaN(opensDate.getTime()) ? msg : undefined,
        dueAt: Number.isNaN(dueDate.getTime()) ? msg : undefined,
      });
      showError(msg);
      return;
    }

    if (opensDate.getTime() >= dueDate.getTime()) {
      const msg = 'La apertura debe ser anterior al cierre';
      setFieldErrors({ dueAt: msg });
      showError(msg);
      return;
    }

    setFieldErrors({});
    createMutation.mutate({
      activityId: selectedActivityId,
      groupIds: selectedGroupIds,
      opensAt: opensAtIso,
      dueAt: dueAtIso,
    });
  };

  if (isLoading) {
    return (
      <div className={styles.page} role="status" aria-live="polite">
        <div className={styles.loadingWrap}>
          <p className={styles.loadingText}>Cargando actividades y grupos…</p>
          <div className={styles.skeletonBlock} />
          <div className={styles.skeletonBlock} />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.page}>
        <ErrorState
          variant="teacher"
          editorial
          message={loadError}
          onRetry={() => {
            void activitiesQuery.refetch();
            void groupsQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Nueva asignación</h1>
        </header>
        <section className={styles.emptyCard} aria-labelledby="empty-activities-heading">
          <h2 id="empty-activities-heading">
            Publica una actividad para poder asignarla
          </h2>
          <p>
            Solo las actividades publicadas de tipo Completar espacios, Pregunta abierta,
            Speaking o Examen pueden asignarse. Los microjuegos publicados quedan abiertos
            24/7 en el portal del estudiante sin requerir asignación.
          </p>
          <div className={styles.emptyActions}>
            <Link href="/actividades/nueva" className={styles.submitButton}>
              Crear actividad
            </Link>
            <Link href="/actividades" className={styles.cancelButton}>
              Ir al catálogo de actividades
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Nueva asignación</h1>
        </header>
        <section className={styles.emptyCard} aria-labelledby="empty-groups-heading">
          <h2 id="empty-groups-heading">
            Crea un grupo activo para poder asignar
          </h2>
          <p>
            Necesitas al menos un grupo activo de estudiantes para poder programar una
            asignación.
          </p>
          <div className={styles.emptyActions}>
            <Link href="/grupos" className={styles.submitButton}>
              Ir a gestión de grupos
            </Link>
            <Link href="/asignaciones" className={styles.cancelButton}>
              Volver a asignaciones
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const allGroupsSelected = selectedGroupIds.length === groups.length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 id="new-assignment-title" className={styles.title}>
          Nueva asignación
        </h1>
        <p className={styles.subtitle}>
          Selecciona una actividad publicada, uno o varios grupos y define la ventana en
          hora de Colombia.
        </p>
      </header>

      <aside className={styles.callout} aria-label="Regla de microjuegos">
        <Info size={18} strokeWidth={1.75} className={styles.calloutIcon} aria-hidden="true" />
        <p className={styles.calloutText}>
          Solo aparecen los 4 tipos evaluables (Completar espacios, Pregunta abierta,
          Expresión oral y Examen). Los <strong>microjuegos</strong> no aparecen aquí
          porque al publicarse quedan abiertos 24/7 para práctica autónoma.
        </p>
      </aside>

      <div className="sr-only" aria-live="polite">
        {politeAnnouncement}
      </div>

      {formError && (
        <div
          ref={errorAlertRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className={styles.errorAlert}
        >
          <div className={styles.errorAlertBody}>
            <CircleAlert
              size={18}
              strokeWidth={1.75}
              className={styles.errorAlertIcon}
              aria-hidden="true"
            />
            <span>{formError}</span>
          </div>
          <button
            type="button"
            onClick={() => setFormError(null)}
            className={styles.errorDismiss}
            aria-label="Cerrar alerta de error"
          >
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby="new-assignment-title"
        className={styles.form}
      >
        {/* Bloque 1: Selección de actividad */}
        <section className={styles.stepCard} aria-labelledby="step-activity-heading">
          <fieldset
            className={styles.fieldset}
            aria-describedby={fieldErrors.activity ? 'activity-field-error' : undefined}
          >
            <legend className={styles.stepLegend}>
              <div className={styles.stepHeader}>
                <div className={styles.stepHeadingWrap}>
                  <div className={styles.stepHeadingRow}>
                    <span className={styles.stepNumber} aria-hidden="true">
                      1
                    </span>
                    <h2 id="step-activity-heading" className={styles.stepTitle}>
                      Selecciona la actividad
                    </h2>
                  </div>
                  <p className={styles.stepHint}>
                    Solo se muestran actividades publicadas asignables.
                  </p>
                </div>
                <span className={styles.countPill}>
                  {filteredActivities.length} disponible
                  {filteredActivities.length === 1 ? '' : 's'}
                </span>
              </div>
            </legend>

            <div className={styles.filterBar} role="group" aria-label="Filtrar actividades">
              <div className={styles.field}>
                <label htmlFor="new-assignment-filter-level" className={styles.fieldLabel}>
                  Nivel MCER
                </label>
                <select
                  id="new-assignment-filter-level"
                  name="levelFilter"
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className={styles.control}
                >
                  <option value="all">Todos los niveles</option>
                  <option value={Level.A1}>Nivel A1</option>
                  <option value={Level.A2}>Nivel A2</option>
                  <option value={Level.B1}>Nivel B1</option>
                  <option value={Level.B2}>Nivel B2</option>
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="new-assignment-filter-type" className={styles.fieldLabel}>
                  Tipo de actividad
                </label>
                <select
                  id="new-assignment-filter-type"
                  name="typeFilter"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className={styles.control}
                >
                  <option value="all">Todos los tipos asignables</option>
                  <option value={ActivityType.fill_blank}>Completar espacios</option>
                  <option value={ActivityType.open_question}>Pregunta abierta</option>
                  <option value={ActivityType.speaking}>Expresión oral (Speaking)</option>
                  <option value={ActivityType.exam}>Examen</option>
                </select>
              </div>
            </div>

            {filteredActivities.length === 0 ? (
              <div className={styles.filteredEmpty}>
                <p>No hay actividades publicadas que coincidan con estos filtros.</p>
                <button
                  type="button"
                  onClick={() => {
                    setLevelFilter('all');
                    setTypeFilter('all');
                  }}
                  className={styles.toggleAllButton}
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div
                role="region"
                aria-label="Lista de actividades publicadas asignables"
                tabIndex={0}
                className={styles.activityListRegion}
              >
                {filteredActivities.map((act) => {
                  const isSelected = act.id === selectedActivityId;
                  return (
                    <label
                      key={act.id}
                      data-selected={isSelected ? 'true' : 'false'}
                      className={styles.activityOption}
                    >
                      <input
                        type="radio"
                        name="activity"
                        value={act.id}
                        checked={isSelected}
                        onChange={() => handleActivitySelect(act.id)}
                        className={styles.nativeChoice}
                      />
                      <span className={styles.optionContent}>
                        <span lang="en" className={styles.optionTitle}>
                          {act.title}
                        </span>
                        <span className={styles.optionMeta}>
                          <span className={styles.levelPill}>Nivel {act.level}</span>
                          <span>{typeLabels[act.type]}</span>
                          <span aria-hidden="true">·</span>
                          <span>v{act.version}</span>
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {fieldErrors.activity && (
              <p id="activity-field-error" className={styles.fieldError}>
                {fieldErrors.activity}
              </p>
            )}
          </fieldset>
        </section>

        {/* Bloque 2: Selección multigrupo */}
        <section className={styles.stepCard} aria-labelledby="step-groups-heading">
          <fieldset
            className={styles.fieldset}
            aria-describedby={fieldErrors.groups ? 'groups-field-error' : undefined}
          >
            <legend className={styles.stepLegend}>
              <div className={styles.stepHeader}>
                <div className={styles.stepHeadingWrap}>
                  <div className={styles.stepHeadingRow}>
                    <span className={styles.stepNumber} aria-hidden="true">
                      2
                    </span>
                    <h2 id="step-groups-heading" className={styles.stepTitle}>
                      Selecciona los grupos destinatarios
                    </h2>
                  </div>
                  <p className={styles.stepHint}>
                    Puedes asignar la actividad a uno o varios grupos activos en una sola
                    operación.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAllGroups}
                  className={styles.toggleAllButton}
                >
                  {allGroupsSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>
            </legend>

            <div className={styles.groupsGrid}>
              {groups.map((group) => {
                const isChecked = selectedGroupIds.includes(group.id);
                return (
                  <label
                    key={group.id}
                    data-selected={isChecked ? 'true' : 'false'}
                    className={styles.groupOption}
                  >
                    <input
                      type="checkbox"
                      name="groupIds"
                      value={group.id}
                      checked={isChecked}
                      onChange={() => handleGroupToggle(group.id)}
                      className={styles.nativeChoice}
                    />
                    <span className={styles.optionContent}>
                      <span className={styles.optionTitle}>{group.name}</span>
                      <span className={styles.optionMeta}>
                        {group.activeStudentCount} alumno
                        {group.activeStudentCount !== 1 ? 's' : ''} activo
                        {group.activeStudentCount !== 1 ? 's' : ''}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {fieldErrors.groups && (
              <p id="groups-field-error" className={styles.fieldError}>
                {fieldErrors.groups}
              </p>
            )}
          </fieldset>
        </section>

        {/* Bloque 3: Ventana temporal */}
        <section className={styles.stepCard} aria-labelledby="step-window-heading">
          <fieldset className={styles.fieldset}>
            <legend className={styles.stepLegend}>
              <div className={styles.stepHeader}>
                <div className={styles.stepHeadingWrap}>
                  <div className={styles.stepHeadingRow}>
                    <span className={styles.stepNumber} aria-hidden="true">
                      3
                    </span>
                    <h2 id="step-window-heading" className={styles.stepTitle}>
                      Ventana temporal
                    </h2>
                  </div>
                  <p className={styles.stepHint}>
                    Define desde cuándo los estudiantes ven la actividad y el límite para
                    iniciarla.
                  </p>
                </div>
                <span className={styles.timezoneBadge}>
                  <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
                  Hora de Colombia (America/Bogota)
                </span>
              </div>
            </legend>

            <div className={styles.datesGrid}>
              <div className={styles.field}>
                <label htmlFor="opens-at" className={styles.fieldLabel}>
                  Apertura
                </label>
                <input
                  id="opens-at"
                  name="opensAt"
                  type="datetime-local"
                  required
                  value={opensAtInput}
                  aria-invalid={fieldErrors.opensAt ? 'true' : 'false'}
                  aria-describedby={
                    fieldErrors.opensAt
                      ? 'opens-at-help opens-at-error'
                      : 'opens-at-help'
                  }
                  onChange={(e) => {
                    setOpensAtInput(e.target.value);
                    setOpensEdited(true);
                    setFieldErrors((prev) => ({
                      ...prev,
                      opensAt: undefined,
                      dueAt:
                        prev.dueAt === 'La apertura debe ser anterior al cierre'
                          ? undefined
                          : prev.dueAt,
                    }));
                  }}
                  onBlur={() => validateDatePairOnBlur('opensAt')}
                  className={styles.control}
                />
                <p id="opens-at-help" className={styles.fieldHelp}>
                  Los alumnos verán la actividad disponible desde esta fecha y hora.
                </p>
                {fieldErrors.opensAt && (
                  <p id="opens-at-error" className={styles.fieldError}>
                    {fieldErrors.opensAt}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="due-at" className={styles.fieldLabel}>
                  Cierre para empezar
                </label>
                <input
                  id="due-at"
                  name="dueAt"
                  type="datetime-local"
                  required
                  value={dueAtInput}
                  aria-invalid={fieldErrors.dueAt ? 'true' : 'false'}
                  aria-describedby={
                    fieldErrors.dueAt ? 'due-at-help due-at-error' : 'due-at-help'
                  }
                  onChange={(e) => {
                    setDueAtInput(e.target.value);
                    setDueEdited(true);
                    setFieldErrors((prev) => ({ ...prev, dueAt: undefined }));
                  }}
                  onBlur={() => validateDatePairOnBlur('dueAt')}
                  className={styles.control}
                />
                <p id="due-at-help" className={styles.fieldHelp}>
                  Límite en hora Colombia para iniciar el primer intento.
                </p>
                {fieldErrors.dueAt && (
                  <p id="due-at-error" className={styles.fieldError}>
                    {fieldErrors.dueAt}
                  </p>
                )}
              </div>
            </div>

            <div className={styles.toleranceBox}>
              <p>
                <strong>Regla de entrega:</strong> los alumnos pueden empezar hasta esta
                hora; quien haya empezado tendrá hasta 24 horas más para terminar.
              </p>
              {extendedDueAtText && (
                <p className={styles.tolerancePreview}>
                  Última hora para terminar si empezó a tiempo: {extendedDueAtText} (hora
                  Colombia)
                </p>
              )}
            </div>
          </fieldset>
        </section>

        {/* Resumen previo a guardar */}
        <section className={styles.summaryCard} aria-labelledby="summary-heading">
          <h2 id="summary-heading" className={styles.summaryTitle}>
            Resumen previo a guardar
          </h2>
          <dl className={styles.summaryList}>
            <div className={styles.summaryRow}>
              <dt>Actividad</dt>
              <dd>
                {selectedActivity ? (
                  <>
                    <span lang="en">{selectedActivity.title}</span> (Nivel{' '}
                    {selectedActivity.level}, {typeLabels[selectedActivity.type]}, v
                    {selectedActivity.version})
                  </>
                ) : (
                  'Ninguna seleccionada'
                )}
              </dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>Grupos seleccionados ({selectedGroups.length})</dt>
              <dd>
                {selectedGroups.length > 0
                  ? selectedGroups.map((g) => g.name).join(', ')
                  : 'Ninguno seleccionado'}
              </dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>Apertura (Colombia)</dt>
              <dd>{opensAtPreview ?? '—'}</dd>
            </div>
            <div className={styles.summaryRow}>
              <dt>Cierre para empezar (Colombia)</dt>
              <dd>{dueAtPreview ?? '—'}</dd>
            </div>
            {extendedDueAtText && (
              <div className={`${styles.summaryRow} ${styles.summaryHighlight}`}>
                <dt>Última hora para terminar si empezó a tiempo</dt>
                <dd>{extendedDueAtText}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Pie de acciones */}
        <div className={styles.actionsFooter}>
          <Link href="/asignaciones" className={styles.cancelButton}>
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className={styles.submitButton}
          >
            {isSubmitting ? 'Guardando…' : 'Programar asignación'}
          </button>
        </div>
      </form>
    </div>
  );
}
