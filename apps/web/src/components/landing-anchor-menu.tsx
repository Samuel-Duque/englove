"use client";

import { Menu } from "lucide-react";
import React, { useRef } from "react";
import styles from "../app/origami-landing.module.css";

const anchors = [
  { href: "#como-se-aprende", label: "Cómo se aprende" },
  { href: "#por-dentro", label: "Por dentro" },
];

function LandingLinks({ onSelect }: { onSelect?: () => void }) {
  return (
    <nav aria-label="Explorar la portada" className={styles.anchorLinks}>
      {anchors.map(({ href, label }) => (
        <a
          className="origami-button origami-button--text"
          href={href}
          key={href}
          onClick={onSelect}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

export function LandingAnchorMenu() {
  const details = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);

  function closeMenu() {
    if (details.current) details.current.open = false;
  }

  return (
    <>
      <div className={styles.inlineAnchors}>
        <LandingLinks />
      </div>
      <details
        className={styles.anchorMenu}
        ref={details}
        onBlur={(event) => {
          if (
            event.relatedTarget &&
            !event.currentTarget.contains(event.relatedTarget)
          )
            closeMenu();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !event.currentTarget.open) return;
          event.preventDefault();
          closeMenu();
          trigger.current?.focus();
        }}
      >
        <summary
          className={`origami-button origami-button--secondary ${styles.menuTrigger}`}
          ref={trigger}
        >
          <Menu aria-hidden="true" />
          <span className="sr-only">Menú de la portada</span>
        </summary>
        <LandingLinks onSelect={closeMenu} />
      </details>
    </>
  );
}
