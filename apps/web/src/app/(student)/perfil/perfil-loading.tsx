import styles from './perfil-kids.module.css';
import teens from './perfil-teens.module.css';

export function PerfilLoading() {
  return (
    <>
      <div className={styles.loading} role="status">
        <span className="sr-only">Cargando tu perfil…</span>
        <div className={styles.skeleton} aria-hidden="true" />
        <div className={styles.skeleton} aria-hidden="true" />
        <div className={styles.skeleton} aria-hidden="true" />
      </div>
      <div className={teens.loading} role="status">
        <p>Cargando tu perfil…</p>
        <div className={teens.skeleton} aria-hidden="true" />
        <div className={teens.skeleton} aria-hidden="true" />
      </div>
    </>
  );
}
