import React from "react";
import Link from "next/link";
import { ExternalLink, Map, WifiOff } from "lucide-react";
import { isValidHttpsResourceUrl } from "@upward-english/shared";
import type { ExternalResourceItem, Level } from "@upward-english/shared";
import { FoxExplorerIllustration } from "../../../components/fox-explorer-illustration";
import { ListenButton } from "../../../components/listen-button";
import styles from "./kids-extra.module.css";

const filters = [
  { value: "todos", label: "Todos" },
  { value: "nivel", label: "Tu nivel" },
  { value: "generales", label: "Para todos" },
] as const;

export type ResourceFilter = (typeof filters)[number]["value"];

export function KidsExtraLoading() {
  return (
    <div className={styles.map}>
      <p className={styles.loadingLabel} role="status">
        Cargando tu mapa de recursos…
      </p>
      <div className={styles.grid} aria-hidden="true">
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
      </div>
    </div>
  );
}

export function KidsExtraUnavailable() {
  return (
    <div className={`${styles.map} ${styles.notice}`}>
      <FoxExplorerIllustration className={styles.fox} />
      <h1 className={styles.title}>Contenido extra no disponible</h1>
      <p>El contenido extra no está habilitado en este momento.</p>
      <p>
        Tu profesora aún está preparando este mapa. Vuelve pronto para explorar
        nuevos recursos.
      </p>
      <Link
        href="/inicio"
        className={`kids-button ${styles.cta}`}
        data-tone="orange"
      >
        Volver al inicio
      </Link>
    </div>
  );
}

export function KidsExtraOffline() {
  return (
    <p className={styles.offline} role="status">
      <WifiOff size={22} aria-hidden="true" />
      Necesitas conexión a internet para abrir enlaces externos.
    </p>
  );
}

interface KidsExtraMapProps {
  items: ExternalResourceItem[];
  studentLevel: Level | null;
  filter: ResourceFilter;
  onFilterChange: (filter: ResourceFilter) => void;
  isOnline: boolean;
}

export function KidsExtraMap({
  items,
  studentLevel,
  filter,
  onFilterChange,
  isOnline,
}: KidsExtraMapProps) {
  return (
    <div className={styles.map}>
      {!isOnline && <KidsExtraOffline />}
      <header className={styles.hero}>
        <span className={styles.stamp} aria-hidden="true">
          <Map size={32} />
        </span>
        <div>
          <h1 className={styles.title}>Mapa de Recursos</h1>
          <p>Explora juegos, videos y lecturas para practicar inglés.</p>
        </div>
        {studentLevel && (
          <span className={styles.level}>Nivel {studentLevel}</span>
        )}
      </header>

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
          {filter === "todos" && (
            <h2>Todavía no hay enlaces extra para explorar.</h2>
          )}
          <p role="status">Aún no hay enlaces en este filtro.</p>
          {filter === "todos" && (
            <Link
              href="/inicio"
              className={`kids-button ${styles.cta}`}
              data-tone="orange"
            >
              Volver al inicio
            </Link>
          )}
        </div>
      ) : (
        <ul
          className={styles.grid}
          aria-label="Tarjetas de contenido extra"
          role="list"
        >
          {items.map((item) => {
            const isValidUrl = isValidHttpsResourceUrl(item.url);
            const speechText = [
              `Escucha este recurso. ${item.title}`,
              item.description,
            ]
              .filter(Boolean)
              .join(". ");

            return (
              <li className={styles.card} key={item.id}>
                <div className={styles.cardTop}>
                  <span className={item.level ? styles.level : styles.general}>
                    {item.level ? `Nivel ${item.level}` : "Para todos"}
                  </span>
                  <ListenButton text={speechText} />
                </div>
                <div className={styles.details}>
                  <h2>{item.title}</h2>
                  {item.description && <p>{item.description}</p>}
                  {isValidUrl && (
                    <span className={styles.domain}>
                      {new URL(item.url).hostname}
                    </span>
                  )}
                </div>
                <div className={styles.actions}>
                  {isValidUrl && (
                    <p className={styles.externalNotice}>
                      Se abre en una nueva pestaña fuera de Upward English.
                    </p>
                  )}
                  {isValidUrl && isOnline ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`kids-button ${styles.cta}`}
                      data-tone="orange"
                    >
                      Abrir recurso externo{" "}
                      <ExternalLink size={18} aria-hidden="true" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      className={`kids-button ${styles.cta}`}
                      disabled
                    >
                      Enlace no disponible
                    </button>
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
