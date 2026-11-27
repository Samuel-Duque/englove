import React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { isValidHttpsResourceUrl } from "@upward-english/shared";
import type { ExternalResourceItem, Level } from "@upward-english/shared";
import { FoxTeensIllustration } from "../../../components/fox-teens-illustration";
import type { ResourceFilter } from "./kids-extra";
import styles from "./teens-extra.module.css";

const filters: { value: ResourceFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "nivel", label: "Tu nivel" },
  { value: "generales", label: "Generales" },
];

export function TeensExtraLoading() {
  return (
    <div className={styles.page}>
      <p className={styles.loadingLabel} role="status">
        Cargando recursos extra…
      </p>
      <div className={styles.grid} aria-hidden="true">
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
      </div>
    </div>
  );
}

function BackToStart() {
  return (
    <Link className={styles.cta} href="/inicio">
      Volver al inicio
    </Link>
  );
}

export function TeensExtraUnavailable() {
  return (
    <div className={styles.notice}>
      <FoxTeensIllustration size={96} />
      <h1 className={styles.title}>Contenido extra no disponible</h1>
      <p>El contenido extra no está habilitado en este momento.</p>
      <BackToStart />
    </div>
  );
}

export function TeensExtraOffline() {
  return (
    <p className={styles.offline} role="status">
      Necesitas conexión a internet para abrir enlaces externos.
    </p>
  );
}

interface TeensExtraProps {
  items: ExternalResourceItem[];
  studentLevel: Level | null;
  filter: ResourceFilter;
  onFilterChange: (filter: ResourceFilter) => void;
  isOnline: boolean;
}

export function TeensExtra({
  items,
  studentLevel,
  filter,
  onFilterChange,
  isOnline,
}: TeensExtraProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Contenido extra</h1>
          <p>Explora recursos para practicar inglés a tu ritmo.</p>
        </div>
        {studentLevel && (
          <span className={styles.level}>Tu nivel: {studentLevel}</span>
        )}
      </header>

      {!isOnline && <TeensExtraOffline />}

      <div
        className={styles.filters}
        role="group"
        aria-label="Filtrar contenido por nivel"
      >
        {filters
          .filter(({ value }) => value !== "nivel" || studentLevel)
          .map(({ value, label }) => (
            <button
              key={value}
              className={styles.filter}
              type="button"
              aria-pressed={filter === value}
              onClick={() => onFilterChange(value)}
            >
              {label}
            </button>
          ))}
      </div>

      {items.length === 0 ? (
        <div className={styles.notice}>
          {filter === "todos" ? (
            <>
              <h2>Aún no hay contenido extra publicado para tu nivel.</h2>
              <BackToStart />
            </>
          ) : (
            <p role="status">Aún no hay recursos en este filtro.</p>
          )}
        </div>
      ) : (
        <ul
          className={styles.grid}
          aria-label="Tarjetas de contenido extra"
          role="list"
        >
          {items.map((item) => {
            const hasValidUrl = isValidHttpsResourceUrl(item.url);

            return (
              <li className={styles.card} key={item.id}>
                <div className={styles.details}>
                  <span className={item.level ? styles.level : styles.general}>
                    {item.level ? `Nivel ${item.level}` : "Todos los niveles"}
                  </span>
                  <h2>{item.title}</h2>
                  {item.description && <p>{item.description}</p>}
                  {hasValidUrl && (
                    <p className={styles.domain}>{new URL(item.url).origin}</p>
                  )}
                </div>
                <div className={styles.actions}>
                  {hasValidUrl ? (
                    <>
                      <p>
                        Se abre en una pestaña nueva fuera de Upward English.
                      </p>
                      <a
                        className={styles.cta}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir recurso externo
                        <ExternalLink size={17} aria-hidden="true" />
                      </a>
                    </>
                  ) : (
                    <p>Enlace no disponible.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
