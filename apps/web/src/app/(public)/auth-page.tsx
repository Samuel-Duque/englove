import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import { UpwardCompassEmblem } from '../../components/landing/brand-emblem';
import styles from './auth-page.module.css';

export function AuthPage({
  variant,
  children,
}: {
  variant: 'login' | 'signup' | 'loading' | 'success';
  children: ReactNode;
}) {
  return (
    <main id="main-content" tabIndex={-1} className={styles.canvas}>
      <div className={`${styles.frame} ${styles[variant]}`}>
        <Link href="/" className={`${styles.link} ${styles.back}`}>
          <ArrowLeft size={18} aria-hidden="true" />
          Volver al inicio
        </Link>
        <article className={styles.card}>{children}</article>
      </div>
    </main>
  );
}

function AuthBrand() {
  return (
    <p className={styles.brand}>
      <span className={styles.emblem}>
        <UpwardCompassEmblem size={28} />
      </span>
      Upward English
    </p>
  );
}

export function AuthHeading({ title, description }: { title: string; description: string }) {
  return (
    <header>
      <AuthBrand />
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{description}</p>
    </header>
  );
}

export function AuthLoading({ message }: { message: string }) {
  return (
    <AuthPage variant="loading">
      <AuthBrand />
      <p role="status" className={styles.status}>
        <span className={styles.spinner} aria-hidden="true" />
        {message}
      </p>
    </AuthPage>
  );
}

export function AuthAlert({ message }: { message: string }) {
  return (
    <div role="alert" className={styles.alert}>
      <CircleAlert size={20} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
