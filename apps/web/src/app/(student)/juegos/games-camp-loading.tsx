import styles from "./games-camp.module.css";

export function GamesCampLoading() {
  return (
    <div className={`${styles.camp} ${styles.kidsLoading}`} role="status">
      <p className="sr-only">Cargando el Campamento de Microjuegos…</p>
      <div
        className={`${styles.banner} ${styles.skeleton}`}
        aria-hidden="true"
      />
      <div className={styles.grid} aria-hidden="true">
        {[1, 2, 3].map((card) => (
          <div key={card} className={`${styles.card} ${styles.skeleton}`} />
        ))}
      </div>
    </div>
  );
}
