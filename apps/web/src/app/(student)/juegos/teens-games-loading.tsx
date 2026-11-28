import styles from './teens-games.module.css';

export function TeensGamesLoading() {
  return (
    <div className={styles.zone} role="status">
      <p className="sr-only">Cargando microjuegos…</p>
      <div className={styles.skeletonBanner} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true">
        {[1, 2, 3].map((card) => (
          <div key={card} className={styles.skeletonCard} />
        ))}
      </div>
    </div>
  );
}
