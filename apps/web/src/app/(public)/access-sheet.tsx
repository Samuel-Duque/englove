import type { ReactNode } from "react";
import styles from "./public-origami.module.css";

export function AccessSheet({
  children,
  registration = false,
}: {
  children: ReactNode;
  registration?: boolean;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`origami-container origami-container--${registration ? "registration" : "access"} ${styles.access}`}
    >
      <div className={`origami-card ${styles.sheet}`}>{children}</div>
    </main>
  );
}

export function AccessLoading({
  children,
  registration,
}: {
  children: ReactNode;
  registration?: boolean;
}) {
  return (
    <AccessSheet registration={registration}>
      <p role="status" className={`origami-state ${styles.loading}`}>
        {children}
      </p>
    </AccessSheet>
  );
}
