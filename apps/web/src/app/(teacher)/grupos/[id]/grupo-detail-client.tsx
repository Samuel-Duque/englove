'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GroupView,
  GroupViewSchema,
  StudentListResponse,
  StudentListResponseSchema,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../../lib/api';
import { ConfirmDialog } from '../../../../components/ui/modal';
import styles from './grupo-detail.module.css';

const MEMBERS_LIMIT = 100;
const archiveBlockedMessage =
  'Para archivar este grupo, traslada primero a sus alumnos activos a otro grupo desde la ficha de cada alumno.';

export function GroupDetailLoading() {
  return (
    <div className={styles.loading} role="status">
      <span className="sr-only">Cargando grupo…</span>
      <div className={styles.skeletonHeading} aria-hidden="true" />
      <div className={styles.skeletonTable} aria-hidden="true" />
    </div>
  );
}

export function GrupoDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const groupHeading = useRef<HTMLHeadingElement>(null);
  const renameButton = useRef<HTMLButtonElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const [newName, setNewName] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<'archive' | 'delete' | null>(null);
  const [membersOffset, setMembersOffset] = useState(0);

  const groupQuery = useQuery({
    queryKey: ['teacher', 'group', id],
    queryFn: () => apiFetch<GroupView>(`/api/v1/groups/${id}`, { schema: GroupViewSchema }),
  });

  const membersQuery = useQuery({
    queryKey:
      membersOffset === 0
        ? ['teacher', 'group', id, 'members']
        : ['teacher', 'group', id, 'members', membersOffset],
    queryFn: () =>
      apiFetch<StudentListResponse>(
        `/api/v1/groups/${id}/members?limit=${MEMBERS_LIMIT}${membersOffset ? `&offset=${membersOffset}` : ''}`,
        { schema: StudentListResponseSchema },
      ),
    enabled: Boolean(groupQuery.data),
  });

  const isRenaming = newName !== null;
  useEffect(() => {
    if (isRenaming) nameInput.current?.focus();
  }, [isRenaming]);

  function closeRename() {
    setNewName(null);
    renameButton.current?.focus();
  }

  const renameMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch<GroupView>(`/api/v1/groups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
        schema: GroupViewSchema,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['teacher', 'group', id], updated);
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'groups'] });
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
      void queryClient.invalidateQueries({
        queryKey: ['teacher', 'assignments'],
      });
      closeRename();
      setSuccess('Grupo renombrado exitosamente.');
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.code === 'GROUP_ARCHIVED') {
        closeRename();
        void queryClient.invalidateQueries({
          queryKey: ['teacher', 'group', id],
        });
        setActionError('No es posible renombrar un grupo archivado.');
        return;
      }
      setActionError(error instanceof ApiError ? error.message : 'No se pudo renombrar el grupo.');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () =>
      apiFetch<GroupView>(`/api/v1/groups/${id}/archive`, {
        method: 'POST',
        schema: GroupViewSchema,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['teacher', 'group', id], updated);
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'groups'] });
      setSuccess('Grupo archivado exitosamente.');
      groupHeading.current?.focus();
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.code === 'GROUP_HAS_ACTIVE_STUDENTS') {
        void queryClient.invalidateQueries({
          queryKey: ['teacher', 'group', id],
        });
        setActionError(archiveBlockedMessage);
        return;
      }
      setActionError(error instanceof ApiError ? error.message : 'No se pudo archivar el grupo.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'groups'] });
      router.push('/grupos');
    },
    onError: (error: unknown) => {
      setActionError(
        error instanceof ApiError && error.code === 'GROUP_HAS_HISTORY'
          ? 'No se puede borrar un grupo con historial. Archívalo en su lugar.'
          : error instanceof ApiError
            ? error.message
            : 'No se pudo eliminar el grupo.',
      );
    },
  });

  const group = groupQuery.data;
  const members = membersQuery.data?.items ?? [];
  const memberCount = membersQuery.data?.total ?? group?.activeStudentCount ?? 0;
  const activeCount = Math.max(group?.activeStudentCount ?? 0, memberCount);
  const isArchived = Boolean(group?.archivedAt);
  const isPending =
    renameMutation.isPending || archiveMutation.isPending || deleteMutation.isPending;
  const isMissing = groupQuery.error instanceof ApiError && groupQuery.error.statusCode === 404;
  const groupError = isMissing ? 'Grupo no encontrado.' : groupQuery.error?.message;
  const membersError = membersQuery.error?.message;

  function clearFeedback() {
    setActionError(null);
    setSuccess(null);
  }

  function handleSaveRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName?.trim();
    if (!name || isPending || isArchived) return;
    clearFeedback();
    renameMutation.mutate(name);
  }

  function handleArchive() {
    if (isPending) return;
    clearFeedback();
    if (activeCount > 0) {
      setActionError(archiveBlockedMessage);
      return;
    }
    setConfirmation('archive');
  }

  function confirmAction() {
    setConfirmation(null);
    clearFeedback();
    if (confirmation === 'archive') archiveMutation.mutate();
    if (confirmation === 'delete') deleteMutation.mutate();
  }

  if (groupQuery.isLoading) return <GroupDetailLoading />;

  if (!group || isMissing) {
    return (
      <div className={styles.page}>
        <Link href="/grupos" className={styles.link}>
          Volver a grupos
        </Link>
        <div role="alert" className={styles.error}>
          {groupError || 'Grupo no encontrado.'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <nav aria-label="Detalle del grupo" className={styles.breadcrumb}>
        <Link href="/grupos" className={styles.link}>
          Grupos
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{group.name}</span>
      </nav>

      <header className={styles.header}>
        <div className={styles.identity}>
          <h1 ref={groupHeading} tabIndex={-1}>
            {group.name}
          </h1>
          <div className={styles.metadata}>
            <span className={`${styles.badge} ${isArchived ? styles.archived : styles.active}`}>
              {isArchived ? 'Archivado' : 'Activo'}
            </span>
            <span>{activeCount === 1 ? '1 alumno activo' : `${activeCount} alumnos activos`}</span>
          </div>
        </div>

        <div className={styles.actions}>
          {!isArchived && (
            <button
              ref={renameButton}
              type="button"
              className={styles.button}
              aria-disabled={isPending || undefined}
              aria-expanded={isRenaming}
              aria-controls={isRenaming ? 'group-rename' : undefined}
              onClick={() => {
                if (isPending) return;
                clearFeedback();
                if (isRenaming) closeRename();
                else setNewName(group.name);
              }}
            >
              Renombrar
            </button>
          )}
          <Link href={`/asignaciones?groupId=${encodeURIComponent(id)}`} className={styles.button}>
            Ver asignaciones
          </Link>
          <Link href="/estadisticas?tab=groups" className={styles.button}>
            Ver estadísticas
          </Link>
          {!isArchived && (
            <button
              type="button"
              className={`${styles.button} ${styles.dangerButton}`}
              aria-disabled={isPending || undefined}
              aria-describedby={activeCount > 0 ? 'group-archive-note' : undefined}
              onClick={handleArchive}
            >
              Archivar grupo
            </button>
          )}
          <button
            type="button"
            className={`${styles.button} ${styles.dangerButton}`}
            aria-disabled={isPending || undefined}
            onClick={() => {
              if (!isPending) setConfirmation('delete');
            }}
          >
            Eliminar grupo
          </button>
        </div>
      </header>

      {!isArchived && newName !== null && (
        <form
          id="group-rename"
          className={`${styles.card} ${styles.rename}`}
          onSubmit={handleSaveRename}
        >
          <div className={styles.field}>
            <label htmlFor="group-name">Nombre del grupo</label>
            <input
              ref={nameInput}
              id="group-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              maxLength={100}
              readOnly={isPending}
              required
            />
          </div>
          <div className={styles.actions}>
            <button
              type="submit"
              className={`${styles.button} ${styles.primaryButton}`}
              disabled={!newName.trim() || isPending}
            >
              Guardar
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={closeRename}
              disabled={isPending}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {actionError && (
        <div role="alert" className={styles.error}>
          {actionError}
        </div>
      )}
      {groupError && (
        <div role="alert" className={styles.error}>
          {groupError}
        </div>
      )}
      {success && (
        <div role="status" className={styles.success}>
          {success}
        </div>
      )}

      {!isArchived && activeCount > 0 && (
        <aside id="group-archive-note" className={styles.callout}>
          <strong>Antes de archivar</strong>
          <p>{archiveBlockedMessage}</p>
        </aside>
      )}

      <section aria-labelledby="group-members-title" className={styles.card}>
        <h2 id="group-members-title" className={styles.sectionHeading}>
          Alumnos miembros vigentes ({memberCount})
        </h2>

        {membersQuery.isLoading && <GroupDetailLoading />}
        {membersError && (
          <div role="alert" className={styles.error}>
            {membersError}
          </div>
        )}
        {membersQuery.isSuccess && members.length === 0 && membersOffset === 0 && (
          <p className={styles.empty}>
            {isArchived
              ? 'Este grupo archivado no tiene miembros vigentes.'
              : 'Este grupo no tiene miembros vigentes. Puedes archivarlo si ya no lo vas a usar.'}
          </p>
        )}
        {members.length > 0 && (
          <div
            className={styles.tableScroll}
            role="region"
            aria-labelledby="group-members-title"
            tabIndex={0}
          >
            <table aria-labelledby="group-members-title">
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Correo</th>
                  <th scope="col">Nivel MCER</th>
                  <th scope="col">Segmento</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <th scope="row">
                      <Link href={`/alumnos/${member.id}`} className={styles.link}>
                        {member.name}
                      </Link>
                    </th>
                    <td>{member.email ?? '—'}</td>
                    <td>{member.level ?? 'Sin nivel'}</td>
                    <td className={styles.segment}>{member.ageSegment ?? '—'}</td>
                    <td>
                      <Link
                        href={`/alumnos/${member.id}`}
                        className={styles.link}
                        aria-label={`Ver ficha de ${member.name}`}
                      >
                        Ver ficha <span aria-hidden="true">→</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(memberCount > MEMBERS_LIMIT || membersOffset > 0) && (
          <nav
            aria-label="Paginación de miembros"
            className={`${styles.actions} ${styles.pagination}`}
          >
            <button
              type="button"
              className={styles.button}
              disabled={membersOffset === 0}
              onClick={() => setMembersOffset(membersOffset - MEMBERS_LIMIT)}
            >
              Anterior
            </button>
            <button
              type="button"
              className={styles.button}
              disabled={membersOffset + MEMBERS_LIMIT >= memberCount || membersQuery.isLoading}
              onClick={() => setMembersOffset(membersOffset + MEMBERS_LIMIT)}
            >
              Siguiente
            </button>
          </nav>
        )}
      </section>

      <div className={styles.dialog}>
        <ConfirmDialog
          isOpen={confirmation !== null}
          title={confirmation === 'delete' ? 'Eliminar grupo' : 'Archivar grupo'}
          message={
            confirmation === 'delete'
              ? '¿Seguro que deseas eliminar este grupo? Solo es posible si no tiene historial.'
              : 'El grupo quedará archivado y conservará su historial. ¿Deseas continuar?'
          }
          isDestructive
          onConfirm={confirmAction}
          onCancel={() => setConfirmation(null)}
        />
      </div>
    </div>
  );
}
