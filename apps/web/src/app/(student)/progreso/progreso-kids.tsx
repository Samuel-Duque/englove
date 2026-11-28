import React from 'react';
import Link from 'next/link';
import { Flame, ShieldCheck, ShieldHalf, Star } from 'lucide-react';
import type { StudentProgressView } from '@upward-english/shared';
import { ErrorState } from '../../../components/error-state';
import { FoxExplorerIllustration } from '../../../components/fox-explorer-illustration';
import { renderBadgeIcon } from '../../../lib/badges';
import styles from './progreso-kids.module.css';

const badgeDate = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const activityScore = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function ProgresoKidsLoading() {
  return (
    <div className={`${styles.diary} ${styles.loading}`} role="status">
      <p>Abriendo tu diario de logros…</p>
      <div className={styles.skeletons} aria-hidden="true">
        <div className={styles.streakSkeleton} />
        <div className={styles.album}>
          <div className={styles.badgeSkeleton} />
          <div className={styles.badgeSkeleton} />
          <div className={styles.badgeSkeleton} />
        </div>
        <div className={styles.rowSkeleton} />
        <div className={styles.rowSkeleton} />
        <div className={styles.rowSkeleton} />
      </div>
    </div>
  );
}

export function ProgresoKidsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.diary}>
      <ErrorState
        variant="kids"
        message="No pudimos cargar tu progreso. Revisa tu conexión e inténtalo de nuevo."
        onRetry={onRetry}
      />
    </div>
  );
}

export function ProgresoKids({ progress }: { progress: StudentProgressView }) {
  const { streak, badges, activities } = progress;
  const ShieldIcon = streak.forgivenessAvailable ? ShieldCheck : ShieldHalf;

  return (
    <div className={styles.diary}>
      <h1 className={styles.title}>Diario de Logros</h1>

      <section className={styles.streak} aria-labelledby="kids-streak-title">
        <div className={styles.streakSummary}>
          <span className={styles.streakIcon} aria-hidden="true"><Flame size={32} /></span>
          <div>
            <h2 id="kids-streak-title">Racha semanal</h2>
            <p className={styles.weeks}>
              {streak.weeks} {streak.weeks === 1 ? 'semana activa' : 'semanas activas'}
            </p>
          </div>
          <div className={streak.forgivenessAvailable ? styles.shieldActive : styles.shieldRecovering}>
            <ShieldIcon size={20} aria-hidden="true" />
            <span>
              {streak.forgivenessAvailable
                ? 'Escudo activo'
                : `Recuperando escudo: ${streak.activeWeeksSinceForgivenessUsed} / 2 semanas`}
            </span>
          </div>
        </div>
        <p className={styles.streakHelp}>
          {streak.forgivenessAvailable
            ? 'El escudo de perdón protege tu racha si una semana necesitas hacer una pausa.'
            : 'Para recuperar tu escudo, completa al menos una actividad por semana durante dos semanas seguidas.'}
        </p>
      </section>

      <section className={styles.section} aria-labelledby="kids-album-title">
        <h2 id="kids-album-title">Álbum de Sellos ({badges.length})</h2>
        {badges.length === 0 ? (
          <div className={styles.empty}>
            <FoxExplorerIllustration className={styles.fox} />
            <p>¡Tu álbum está listo! Completa tu primera parada para ganar tu primer sello.</p>
          </div>
        ) : (
          <ul className={styles.album} role="list">
            {badges.map((badge) => (
              <li key={badge.id} className={styles.badge}>
                <span className={styles.medal} aria-hidden="true">{renderBadgeIcon(badge.icon)}</span>
                <div className={styles.badgeText}>
                  <h3>{badge.name}</h3>
                  <p>{badge.description}</p>
                  <p className={styles.date}>
                    Ganada el <time dateTime={badge.awardedAt}>{badgeDate.format(new Date(badge.awardedAt))}</time>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="kids-history-title">
        <h2 id="kids-history-title">Historial de actividades entregadas</h2>
        {activities.length === 0 ? (
          <div className={styles.empty}>
            <p>Aún no has entregado actividades. ¡Empieza una parada desde Inicio!</p>
            <Link href="/inicio" className={`${styles.action} ${styles.routeAction}`}>Ir a mi ruta</Link>
          </div>
        ) : (
          <ul className={styles.history} role="list">
            {activities.map((activity) => {
              const title = activity.activityTitle ||
                `Actividad #${activity.attemptNumber ?? activity.attemptId.slice(0, 8)}`;
              const { score } = activity;

              return (
                <li key={activity.attemptId} className={styles.historyRow}>
                  <div className={styles.activity}>
                    <h3 lang={activity.activityTitle ? 'en' : undefined}>{title}</h3>
                    <p>{activity.attemptNumber ? `Intento #${activity.attemptNumber}` : 'Actividad entregada'}</p>
                  </div>

                  {score === null ? (
                    <span className={styles.pending}>En revisión</span>
                  ) : (
                    <div className={styles.result}>
                      <span className={styles.stars} role="img" aria-label={`${activity.stars} de 3 estrellas`}>
                        {[0, 1, 2].map((index) => (
                          <Star key={index} size={18} fill={index < activity.stars ? 'var(--progress-yellow)' : 'none'} aria-hidden="true" />
                        ))}
                      </span>
                      <span className={styles.score}>{activityScore.format(score)} / 5,0</span>
                    </div>
                  )}

                  <Link href={`/actividad/${activity.attemptId}`} className={styles.action} aria-label={`Ver detalles de ${title}`}>
                    Ver detalles
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
