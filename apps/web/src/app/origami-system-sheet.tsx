import React, { type ReactNode } from "react";
import styles from "./origami-system.module.css";

export function SystemSheet({
  title,
  description,
  icon,
  label,
  variant = "info",
  segment = false,
  children,
}: {
  title?: string;
  description: string;
  icon?: ReactNode;
  label?: string;
  variant?: "info" | "warning" | "error";
  segment?: boolean;
  children?: ReactNode;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`origami-shell ${styles.page} ${segment ? styles.segment : ""}`}
    >
      <div
        className={`origami-container origami-container--access origami-card ${styles.sheet}`}
      >
        <div
          className={styles.intro}
          role={variant === "error" ? "alert" : title ? undefined : "status"}
        >
          {icon && (
            <div
              className={`origami-state ${variant !== "info" ? `origami-state--${variant}` : ""} ${styles.icon}`}
              aria-hidden="true"
            >
              {icon}
            </div>
          )}
          {label && <p className="origami-meta">{label}</p>}
          {title && <h1 className="origami-page-title">{title}</h1>}
          <p className={title ? "origami-meta" : "origami-state"}>
            {description}
          </p>
        </div>
        {children && <div className={styles.actions}>{children}</div>}
      </div>
    </main>
  );
}
