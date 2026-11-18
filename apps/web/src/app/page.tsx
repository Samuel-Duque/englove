import { ClipboardCheck, Gamepad2, Volume2 } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import React from "react";
import { LandingAnchorMenu } from "../components/landing-anchor-menu";
import { PublicFooter } from "../components/origami-footer";
import { PublicHeader } from "../components/public-header";
import { OrigamiCrane } from "../components/ui/origami-brand";
import styles from "./origami-landing.module.css";

export const metadata: Metadata = {
  title: "Aprende inglés jugando",
};

const learningSteps = [
  {
    title: "Escucha una palabra",
    description: (
      <>
        Escucha cómo suena <span lang="en">bird</span>, que significa pájaro.
      </>
    ),
    icon: Volume2,
  },
  {
    title: "Practica con una actividad",
    description:
      "Busca el dibujo del pájaro y relaciónalo con la palabra en inglés.",
    icon: Gamepad2,
  },
  {
    title: "Revisa lo aprendido",
    description:
      "Lee la devolución de tu profesora para saber qué seguir practicando.",
    icon: ClipboardCheck,
  },
];

function PaperScene() {
  return (
    <figure className={styles.scene}>
      <div aria-hidden="true" className={styles.stage}>
        <svg
          className={styles.flightPath}
          viewBox="0 0 400 180"
          focusable="false"
        >
          <path
            d="M14 147C87 178 105 56 161 89S263 174 387 62"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="5 7"
          />
        </svg>
        <div className={styles.wordPaper} lang="en">
          bird
        </div>
        <div className={styles.foldPaper} />
        <OrigamiCrane className={styles.crane} unfold />
      </div>
      <figcaption className={`origami-meta ${styles.sceneCaption}`}>
        Ejemplo ilustrado: de la palabra a la figura.
        <span className="sr-only">
          {" "}
          Una hoja con la palabra <span lang="en">bird</span> se pliega hasta
          formar una grulla.
        </span>
      </figcaption>
    </figure>
  );
}

function ActivityExample({ audience }: { audience: "Kids" | "Teens" }) {
  return (
    <article
      className={`${styles.sample} ${audience === "Kids" ? styles.kids : ""}`}
    >
      <h3 className="origami-card-title">{audience}</h3>
      <p>Une la palabra con su imagen.</p>
      <div className={styles.wordPair}>
        <svg
          className={styles.bird}
          viewBox="0 0 56 40"
          role="img"
          aria-label="Un pájaro"
          focusable="false"
        >
          <path
            d="M5 35h45"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="m27 29 3 6m8-6 2 6M10 20h11C28 18 28 6 38 6c5 0 8 3 9 8l6 3-6 2c-2 8-8 11-17 11-11 0-16-5-20-10Z"
            fill="var(--origami-honey)"
            stroke="var(--origami-on-honey)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="m23 22 14-3-8 8Z" fill="var(--origami-orange)" />
          <circle cx="42" cy="13" r="1.8" fill="var(--origami-on-honey)" />
        </svg>
        <span lang="en">bird</span>
      </div>
    </article>
  );
}

export default function HomePage() {
  return (
    <>
      <div className={styles.header}>
        <PublicHeader>
          <LandingAnchorMenu />
          <Link
            className={`origami-button origami-button--text ${styles.headerLogin}`}
            href="/login"
          >
            Iniciar sesión
          </Link>
        </PublicHeader>
      </div>
      <main className="origami-shell" id="main-content" tabIndex={-1}>
        <div className={`origami-container ${styles.landing}`}>
          <section aria-labelledby="landing-heading" className={styles.hero}>
            <div className={styles.intro}>
              <h1 className="origami-hero-title" id="landing-heading">
                Una palabra, un pliegue, una nueva forma de aprender inglés.
              </h1>
              <p className="origami-reading">
                Actividades de inglés para estudiantes de 7 a 14 años, con
                práctica de escucha, juegos y acompañamiento de su profesora.
              </p>
              <div className={styles.heroActions}>
                <Link className="origami-button" href="/login">
                  Entrar a mi portal
                </Link>
                <Link
                  className="origami-button origami-button--secondary"
                  href="/registro"
                >
                  Crear cuenta de estudiante
                </Link>
              </div>
            </div>
            <PaperScene />
          </section>

          <section
            aria-labelledby="learning-heading"
            className={styles.sectionHeading}
            id="como-se-aprende"
            tabIndex={-1}
          >
            <h2 className="origami-section-title" id="learning-heading">
              Cómo se aprende
            </h2>
            <ol className={styles.folds} role="list">
              {learningSteps.map(({ title, description, icon: Icon }) => (
                <li className={styles.step} key={title}>
                  <span aria-hidden="true" className={styles.stepIcon}>
                    <Icon />
                  </span>
                  <h3 className="origami-card-title">{title}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ol>
          </section>

          <section
            aria-labelledby="inside-heading"
            className={styles.sectionHeading}
            id="por-dentro"
            tabIndex={-1}
          >
            <div>
              <h2 className="origami-section-title" id="inside-heading">
                Por dentro
              </h2>
              <p className="origami-meta">Ejemplo de actividad</p>
              <p className="origami-reading">
                La misma práctica aparece con más espacio en Kids y con menos
                elementos en Teens.
              </p>
            </div>
            <div className={styles.audiences}>
              <ActivityExample audience="Kids" />
              <ActivityExample audience="Teens" />
              <article className={`${styles.sample} ${styles.review}`}>
                <h3 className="origami-card-title">Revisión de la profesora</h3>
                <p className="origami-reading">
                  La profesora revisa la actividad y puede dejar un comentario
                  para orientar la práctica.
                </p>
                <p className="origami-meta">Comentario de ejemplo</p>
                <blockquote>
                  Relacionaste <span lang="en">bird</span> con el dibujo. Ahora
                  intenta decir la palabra en voz alta.
                </blockquote>
              </article>
            </div>
          </section>

          <section aria-labelledby="close-heading" className={styles.close}>
            <div className={styles.closeTop}>
              <h2 className="origami-section-title" id="close-heading">
                ¿Ya tienes una cuenta?
              </h2>
              <Link className="origami-button" href="/login">
                Iniciar sesión
              </Link>
            </div>
            <div>
              <p className="origami-reading">
                Si aún no tienes una cuenta de estudiante, solicita una. Tu
                profesora debe aprobarla antes de que puedas entrar.
              </p>
              <Link className={styles.registrationLink} href="/registro">
                Crear cuenta de estudiante
              </Link>
            </div>
          </section>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
