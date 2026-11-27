'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, ClipboardList, Plus, RefreshCw, UserRoundPlus } from 'lucide-react';
import {
  GroupListResponseSchema,
  RemindersResponseSchema,
  type GroupListResponse,
  type RemindersResponse,
  type SessionView,
} from '@upward-english/shared';
import type { ReactNode } from 'react';
import { ErrorState } from '../../components/error-state';
import { EditorialBadge, EditorialTable } from '../../components/teacher-editorial';
import { teacherDestinations } from '../../components/teacher-nav';
import { TeacherShell } from '../../components/teacher-shell';
import styles from '../../components/teacher-portal.module.css';
import { apiFetch } from '../../lib/api';
import { POLLING_INTERVAL_MS } from '../../lib/query-client';

const bogotaDate = new Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeZone: 'America/Bogota' });
const bogotaTime = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/Bogota' });

function DashboardLink({ href, children, label }: { href: string; children: ReactNode; label?: string }) {
  return (
    <Link href={href} className={styles.actionLink} aria-label={label}>
      {children}<ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}

function ReminderCard({ title, description, count, tone, icon: Icon, href, action, note }: {
  title: string;
  description: string;
  count: number;
  tone: 'warm' | 'danger';
  icon: typeof ClipboardList;
  href: string;
  action: string;
  note?: string;
}) {
  return (
    <article className={`${styles.card} ${styles.reminder}`} data-tone={count ? tone : 'ok'}>
      <h3>{title}</h3>
      <div className={styles.reminderMetric} aria-hidden="true">
        <span className={styles.iconTile}>{count ? <Icon size={20} strokeWidth={1.75} /> : <Check size={20} strokeWidth={1.75} />}</span>
        <strong className={styles.count}>{count}</strong>
      </div>
      <p>{description}</p>
      {note && <p className={styles.note}>{note}</p>}
      <DashboardLink href={href}>{action}</DashboardLink>
    </article>
  );
}

function Reminders({ data }: { data: RemindersResponse }) {
  const { pendingRegistrations, overdueReviews, ungradedReminderDays } = data;
  const days = ungradedReminderDays === 1 ? '1 día' : `${ungradedReminderDays} días`;
  return (
    <div className={styles.reminderGrid}>
      <ReminderCard
        title="Solicitudes de registro"
        description={pendingRegistrations === 0 ? 'No hay alumnos pendientes de aprobación.' : pendingRegistrations === 1 ? 'Hay 1 alumno esperando aprobación de cuenta.' : `Hay ${pendingRegistrations} alumnos esperando aprobación de cuenta.`}
        count={pendingRegistrations}
        tone="warm"
        icon={UserRoundPlus}
        href="/alumnos/solicitudes"
        action="Revisar solicitudes"
      />
      <ReminderCard
        title="Entregas sin calificar"
        description={overdueReviews === 0 ? `No hay entregas pendientes con más de ${days} desde su cierre.` : overdueReviews === 1 ? `Hay 1 entrega pendiente de calificar hace más de ${days}.` : `Hay ${overdueReviews} entregas pendientes de calificar hace más de ${days}.`}
        count={overdueReviews}
        tone="danger"
        icon={ClipboardList}
        href="/revision"
        action="Ir a revisión"
        note="Si hay pendientes, se envía un resumen por correo cada 3 días."
      />
    </div>
  );
}

export function TeacherHome({ user }: { user: SessionView['user'] }) {
  const reminders = useQuery({
    queryKey: ['teacher', 'reminders', user.id],
    queryFn: ({ signal }) => apiFetch<RemindersResponse>('/api/v1/dashboard/reminders', { schema: RemindersResponseSchema, signal }),
    refetchInterval: POLLING_INTERVAL_MS,
  });
  const groups = useQuery({
    queryKey: ['teacher', 'home-groups', user.id],
    queryFn: ({ signal }) => apiFetch<GroupListResponse>('/api/v1/groups?archived=false&limit=20', { schema: GroupListResponseSchema, signal }),
    refetchInterval: POLLING_INTERVAL_MS,
  });
  const isFetching = reminders.isFetching || groups.isFetching;
  const updateFailed = reminders.isError || groups.isError;
  const lastUpdated = Math.min(reminders.dataUpdatedAt, groups.dataUpdatedAt);
  const utility = (
    <>
      <p role="status">
        {updateFailed ? 'No se pudieron actualizar todos los datos' : lastUpdated
          ? <>Actualizado <time dateTime={new Date(lastUpdated).toISOString()}>{bogotaTime.format(lastUpdated)}</time> · cada 30 s</>
          : 'Actualización cada 30 s'}
      </p>
      <button type="button" className={styles.textButton} disabled={isFetching} onClick={() => {
        void reminders.refetch();
        void groups.refetch();
      }}>
        <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />Refrescar
      </button>
    </>
  );

  return (
    <TeacherShell teacherName={user.name} utility={utility}>
      <div className={styles.dashboard}>
        <header>
          <div>
            <h1>Buen día, {user.name}</h1>
            <p className={styles.date}>{bogotaDate.format(new Date())}</p>
          </div>
          <Link href="/actividades/nueva" className={styles.primaryButton}>
            <Plus size={20} strokeWidth={1.75} aria-hidden="true" />Nueva actividad
          </Link>
        </header>

        <section className={styles.section} aria-labelledby="teacher-reminders">
          <h2 id="teacher-reminders">Recordatorios prioritarios</h2>
          {reminders.isPending && (
            <div className={styles.reminderGrid} role="status">
              <span className="sr-only">Cargando recordatorios…</span>
              <div className={styles.skeleton} /><div className={styles.skeleton} />
            </div>
          )}
          {reminders.isError && (reminders.data
            ? <p role="status" className={styles.stale}>Mostramos los últimos recordatorios disponibles.</p>
            : <ErrorState variant="teacher" editorial message="No pudimos cargar los recordatorios." onRetry={() => void reminders.refetch()} />)}
          {reminders.data && <Reminders data={reminders.data} />}
        </section>

        <section className={styles.section} aria-labelledby="teacher-groups">
          <div className={styles.sectionHeader}>
            <h2 id="teacher-groups">Grupos activos</h2>
            <DashboardLink href="/grupos">Ver todos los grupos</DashboardLink>
          </div>
          {groups.isPending && <div role="status" className={styles.skeleton}><span className="sr-only">Cargando grupos…</span></div>}
          {groups.isError && (groups.data
            ? <p role="status" className={styles.stale}>Mostramos los últimos grupos disponibles.</p>
            : <ErrorState variant="teacher" editorial message="No pudimos cargar los grupos activos." onRetry={() => void groups.refetch()} />)}
          {groups.data && (groups.data.items.length ? (
            <EditorialTable labelledBy="teacher-groups">
              <thead><tr><th scope="col">Grupo</th><th scope="col">Alumnos activos</th><th scope="col"><span className="sr-only">Acción</span></th></tr></thead>
              <tbody>
                {groups.data.items.map((group) => (
                  <tr key={group.id}>
                    <th scope="row">{group.name}</th>
                    <td>{group.activeStudentCount}</td>
                    <td><DashboardLink href={`/grupos/${encodeURIComponent(group.id)}`} label={`Ver grupo: ${group.name}`}>Ver grupo</DashboardLink></td>
                  </tr>
                ))}
              </tbody>
            </EditorialTable>
          ) : (
            <div className={`${styles.card} ${styles.empty}`}>
              <EditorialBadge>Sin grupos activos</EditorialBadge>
              <DashboardLink href="/grupos">Crear el primer grupo</DashboardLink>
            </div>
          ))}
        </section>

        <section className={styles.section} aria-labelledby="teacher-quick-links">
          <h2 id="teacher-quick-links">Accesos rápidos</h2>
          <div className={styles.quickGrid}>
            {teacherDestinations.filter(({ href }) => href !== '/inicio').map(({ label, href, description, icon: Icon }) => (
              <Link key={href} href={href} className={styles.quickLink}>
                <span className={styles.iconTile}><Icon size={20} strokeWidth={1.65} aria-hidden="true" /></span>
                <h3>{label}</h3>
                <p>{description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </TeacherShell>
  );
}
