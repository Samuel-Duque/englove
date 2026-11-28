import React from 'react';
import Link from 'next/link';
import { Flame, ShieldCheck, ShieldHalf, Star } from 'lucide-react';
import type { StudentProgressView } from '@upward-english/shared';
import { ErrorState } from '../../../components/error-state';
import { FoxTeensIllustration } from '../../../components/fox-teens-illustration';
import { renderBadgeIcon } from '../../../lib/badges';
import styles from './progreso-teens.module.css';

const badgeDateFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const activityScoreFormatter = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function ProgresoTeensLoading() {
  return (
    <div className={`${styles.page} ${styles.loading}`} role="status">
      <p className={styles.loadingText}>Cargando tu progreso…</p>
      <div className={styles.skeletons} aria-hidden="true">
        <div className={styles.streakSkeleton} />
        <div className={styles.badgesGrid}>
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

export function ProgresoTeensError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.page}>
      <ErrorState
        variant="teens"
        message="No pudimos cargar tu progreso. Revisa tu conexión e inténtalo de nuevo."
        onRetry={onRetry}
      />
    </div>
  );
}

export function ProgresoTeens({ progress }: { progress: StudentProgressView }) {
  const { streak, badges, activities } = progress;
  const ShieldIcon = streak.forgivenessAvailable ? ShieldCheck : ShieldHalf;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Tu Progreso y Logros</h1>
        <p className={styles.subtitle}>
          Racha semanal perdonable, insignias alcanzadas e historial de actividades entregadas.
        </p>
      </header>

      <section className={styles.streakCard} aria-labelledby="teens-streak-title">
        <div className={styles.streakTop}>
          <span className={styles.streakIcon} aria-hidden="true">
            <Flame size={28} />
          </span>
          <div>
            <h2 id="teens-streak-title" className={styles.streakLabel}>
              Racha semanal
            </h2>
            <p className={styles.weeks}>
              {streak.weeks} {streak.weeks === 1 ? 'semana seguida' : 'semanas seguidas'}
            </p>
          </div>
          <div className={streak.forgivenessAvailable ? styles.shieldActive : styles.shieldRecovering}>
            <ShieldIcon size={18} aria-hidden="true" />
            <span>
              {streak.forgivenessAvailable
                ? 'Escudo de perdón activo'
                : `Recuperando escudo: ${streak.activeWeeksSinceForgivenessUsed} de 2 semanas`}
            </span>
          </div>
        </div>
        <p className={styles.streakHelp}>
          {streak.forgivenessAvailable
            ? 'Tu escudo de perdón está activo: protege tu racha si una semana no puedes completar actividades (máximo 1 disponible con racha activa).'
            : 'Usaste tu escudo de perdón. Completa al menos una actividad durante 2 semanas activas consecutivas para recuperarlo.'}
        </p>
      </section>

      <section className={styles.section} aria-labelledby="teens-badges-title">
        <h2 id="teens-badges-title">Insignias ({badges.length})</h2>
        {badges.length === 0 ? (
          <div className={styles.emptyCard}>
            <FoxTeensIllustration className={styles.emptyFox} />
            <p>
              Aún no has desbloqueado insignias. Completa tu primera actividad o mantén tu racha semanal para obtenerlas.
            </p>
            <Link href="/inicio" className={styles.primaryCta}>
              Ir a inicio
            </Link>
          </div>
        ) : (
          <ul className={styles.badgesGrid} role="list">
            {badges.map((badge) => (
              <li key={badge.id} className={styles.badgeCard}>
                <span className={styles.medal} aria-hidden="true">
                  {renderBadgeIcon(badge.icon)}
                </span>
                <div className={styles.badgeBody}>
                  <h3>{badge.name}</h3>
                  <p className={styles.badgeDesc}>{badge.description}</p>
                  <p className={styles.badgeDate}>
                    Ganada el{' '}
                    <time dateTime={badge.awardedAt}>
                      {badgeDateFormatter.format(new Date(badge.awardedAt))}
                    </time>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="teens-history-title">
        <div className={styles.sectionHeader}>
          <h2 id="teens-history-title">Historial de actividades ({activities.length})</h2>
          <p className={styles.sectionSub}>
            Escala oficial 0,0–5,0 (excluye microjuegos de práctica libre).
          </p>
        </div>

        {activities.length === 0 ? (
          <div className={styles.emptyCard}>
            <FoxTeensIllustration className={styles.emptyFox} />
            <p>Todavía no tienes entregas registradas. Inicia una actividad desde Inicio.</p>
            <Link href="/inicio" className={styles.primaryCta}>
              Ir a inicio
            </Link>
          </div>
        ) : (
          <ul className={styles.historyList} role="list">
            {activities.map((activity) => {
              const title =
                activity.activityTitle ||
                `Actividad #${activity.attemptNumber ?? activity.attemptId.slice(0, 8)}`;
              const { score } = activity;

              return (
                <li key={activity.attemptId} className={styles.historyRow}>
                  <div className={styles.activityMeta}>
                    <h3 lang={activity.activityTitle ? 'en' : undefined}>{title}</h3>
                    <p>
                      {activity.attemptNumber
                        ? `Intento #${activity.attemptNumber}`
                        : 'Actividad entregada'}
                    </p>
                  </div>

                  {score === null || score === undefined ? (
                    <span className={styles.pendingPill}>En revisión</span>
                  ) : (
                    <div className={styles.result}>
                      <span
                        className={styles.stars}
                        role="img"
                        aria-label={`${activity.stars} de 3 estrellas`}
                      >
                        {[0, 1, 2].map((index) => (
                          <Star
                            key={index}
                            size={18}
                            fill={index < activity.stars ? 'var(--yellow, #ffca3a)' : 'none'}
                            aria-hidden="true"
                          />
                        ))}
                      </span>
                      <span className={styles.score}>
                        {activityScoreFormatter.format(score)} / 5,0
                      </span>
                    </div>
                  )}

                  <Link
                    href={`/actividad/${activity.attemptId}`}
                    className={styles.detailLink}
                    aria-label={`Ver detalles de ${title}`}
                  >
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
