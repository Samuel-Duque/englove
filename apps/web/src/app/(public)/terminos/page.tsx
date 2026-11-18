import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import styles from "../public-origami.module.css";

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description:
    "Términos y condiciones de uso de la plataforma educativa Upward English.",
};

export default function TerminosPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="origami-container origami-container--reading"
    >
      <article className={`origami-card ${styles.termsBody}`}>
        <header className={`${styles.intro} ${styles.legalIntro}`}>
          <Link href="/login" className={styles.textLink}>
            <ArrowLeft aria-hidden="true" /> Volver al inicio
          </Link>
          <h1 className="origami-page-title">Términos y Condiciones de Uso</h1>
          <p className="origami-meta">
            Versión v1.0 — Vigente para el entorno educativo de Upward English
          </p>
        </header>

        <div
          role="status"
          className={`origami-state origami-state--warning ${styles.notice}`}
        >
          <TriangleAlert aria-hidden="true" />
          <div>
            <strong className="font-bold">Aviso legal provisional:</strong> Este
            documento es un borrador informativo para el piloto educativo de
            Upward English y se encuentra pendiente de validación jurídica
            definitiva antes del lanzamiento oficial.
          </div>
        </div>

        <section className={`origami-reading ${styles.termsBody}`}>
          <h2 className="origami-section-title">
            1. Propósito de la Plataforma
          </h2>
          <p>
            Upward English es una plataforma educativa diseñada para facilitar
            la enseñanza y aprendizaje del idioma inglés en niños y adolescentes
            mediante actividades pedagógicas gamificadas, supervisadas por
            docentes.
          </p>

          <h2 className="origami-section-title">
            2. Registro y Aprobación de Cuentas
          </h2>
          <p>
            El registro de estudiantes requiere la autorización de un acudiente
            o tutor legal. Toda cuenta de estudiante nueva permanece en estado
            pendiente de aprobación hasta que la docente a cargo valida los
            datos y asigna el nivel y grupo correspondiente.
          </p>

          <h2 className="origami-section-title">
            3. Privacidad y Protección de Datos
          </h2>
          <p>
            En cumplimiento de la legislación de protección de datos personales
            de menores de edad, la información recopilada se utiliza
            exclusivamente con fines educativos, de seguimiento pedagógico y
            evaluación del progreso académico. No se comparten datos con
            terceros ni se utilizan para fines publicitarios o comerciales.
          </p>

          <h2 className="origami-section-title">
            4. Grabaciones de Audio y Material Educativo
          </h2>
          <p>
            Las actividades de pronunciación y expresión oral (speaking)
            implican la grabación de audio. Estas grabaciones se almacenan de
            forma segura para permitir la retroalimentación docente y el
            análisis de pronunciación del alumno.
          </p>

          <h2 className="origami-section-title">5. Uso Responsable</h2>
          <p>
            Los estudiantes y docentes se comprometen a hacer un uso respetuoso
            y constructivo de las herramientas de la plataforma. La docente se
            reserva el derecho de administrar o suspender accesos ante cualquier
            uso indebido de las cuentas o materiales.
          </p>
        </section>

        <footer className={styles.legalFooter}>
          <p className="origami-meta">
            Upward English — Plataforma Educativa de Inglés
          </p>
          <div className={styles.related}>
            <Link href="/registro" className={styles.textLink}>
              Ir a Registro
            </Link>
            <Link href="/login" className={styles.textLink}>
              Iniciar Sesión
            </Link>
          </div>
        </footer>
      </article>
    </main>
  );
}
