import type { Metadata } from 'next';
import Link from 'next/link';
import { UpwardCompassEmblem } from '@/components/landing/brand-emblem';
import { LandingHeader } from '@/components/landing/landing-header';
import '@/components/landing/landing.css';

export const metadata: Metadata = {
  title: {
    absolute: 'Upward English — Aprende inglés jugando, hablando y explorando',
  },
  description:
    'Upward English es tu espacio para aprender inglés con juegos interactivos, grabaciones cortas de tu voz y comentarios con stickers de tu profesora cada semana.',
};

/**
 * Página de bienvenida pública de Upward English (Server Component).
 */
export default function HomePage() {
  return (
    <div className="upward-landing">
      <LandingHeader />

      <main id="main-content" tabIndex={-1}>
        <section className="hero" id="inicio" aria-labelledby="hero-heading">
          <div className="container">
            <div className="hero-grid">
              <div>
                <span className="kicker">
                  Inglés para explorar · 7 a 14 años · Niveles A1 a B2
                </span>
                <h1 className="hero-title" id="hero-heading">
                  Aprende inglés jugando, hablando y descubriendo nuevas palabras
                </h1>
                <p className="hero-copy">
                  Upward English es tu espacio para aprender inglés con juegos
                  interactivos, grabaciones cortas de tu voz y comentarios con
                  stickers de tu profesora cada semana.
                </p>

                <div className="hero-cta-row">
                  <Link href="/registro" className="btn btn--red btn--lg">
                    Empezar mi aventura
                  </Link>
                  <a href="#juegos" className="btn btn--yellow btn--lg">
                    Descubre los juegos
                  </a>
                </div>
              </div>

              <div className="hero-visual">
                <div className="art-frame art-frame--hero">
                  <img
                    src="/landing/hero-expedition.png"
                    width={1376}
                    height={768}
                    loading="eager"
                    decoding="async"
                    alt="Ilustración del Zorro Explorador de Upward English con pañoleta amarilla guiando a una niña y a un niño por un sendero soleado hacia un campamento, con burbujas flotantes de brújula, estrella, nota musical y micrófono"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="section section--warm"
          id="que-es"
          aria-labelledby="que-es-heading"
        >
          <div className="container">
            <div className="section-header section-header--center">
              <span className="kicker">Aprender inglés se siente diferente aquí</span>
              <h2 className="section-title" id="que-es-heading">
                ¿Qué hace especial a Upward English?
              </h2>
              <p className="section-lead">
                Combinamos práctica libre con juegos, actividades semanales
                guiadas y el acompañamiento cercano de tu profesora.
              </p>
            </div>

            <div className="pillars-grid">
              <article className="pillar-card">
                <div className="pillar-icon pillar-icon--yellow" aria-hidden="true">
                  🎮
                </div>
                <h3 className="pillar-title">Aprende jugando a tu ritmo</h3>
                <p className="pillar-text">
                  Entra a los juegos a cualquier hora y practica las veces que
                  quieras. Ganas estrellas de práctica sin notas ni presión.
                </p>
              </article>

              <article className="pillar-card">
                <div className="pillar-icon pillar-icon--orange" aria-hidden="true">
                  🎙️
                </div>
                <h3 className="pillar-title">Habla inglés con confianza</h3>
                <p className="pillar-text">
                  Graba tu voz contando historias o respondiendo preguntas cortas
                  y recibe comentarios amables y stickers de tu profesora.
                </p>
              </article>

              <article className="pillar-card">
                <div className="pillar-icon pillar-icon--green" aria-hidden="true">
                  🧭
                </div>
                <h3 className="pillar-title">Avanza semana a semana</h3>
                <p className="pillar-text">
                  Colecciona insignias, sube desde el nivel A1 hasta B2 y cuenta
                  con un escudo de perdón que cuida tu racha si una semana te
                  ausentas.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="juegos" aria-labelledby="juegos-heading">
          <div className="container">
            <div className="section-header">
              <span className="kicker">Aprender disfrutando · A tu propio ritmo</span>
              <h2 className="section-title" id="juegos-heading">
                Aprende inglés jugando, sin presión y con ganas de volver
              </h2>
              <p className="section-lead">
                A través de juegos interactivos de palabras, memoria, asociación y
                retos ágiles, practicar inglés deja de sentirse como una tarea
                pesada y se convierte en una experiencia divertida que da
                resultados reales.
              </p>
            </div>

            <div className="split-showcase">
              <div className="art-frame art-frame--feature">
                <img
                  src="/landing/games-adventure.png"
                  width={1200}
                  height={896}
                  loading="lazy"
                  decoding="async"
                  alt="Ilustración del Zorro Explorador celebrando junto a una tableta luminosa sobre un escritorio de madera con fichas táctiles, tarjetas de memoria de animales, rompecabezas y estrellas doradas"
                />
              </div>

              <div className="benefits-stack">
                <article className="benefit-card">
                  <div className="benefit-badge" aria-hidden="true">
                    🧠
                  </div>
                  <div>
                    <h3 className="benefit-title">
                      Recuerdas palabras de forma natural
                    </h3>
                    <p className="benefit-desc">
                      Cuando juegas con vocabulario y frases cortas, tu mente
                      conecta significados con diversión y retiene mucho más que
                      repitiendo listas.
                    </p>
                  </div>
                </article>

                <article className="benefit-card">
                  <div className="benefit-badge" aria-hidden="true">
                    ⭐
                  </div>
                  <div>
                    <h3 className="benefit-title">
                      Practicas sin miedo a equivocarte
                    </h3>
                    <p className="benefit-desc">
                      Los juegos son para practicar y ganar estrellas a tu ritmo,
                      sin notas que afecten tu promedio ni límites de intentos.
                    </p>
                  </div>
                </article>

                <article className="benefit-card">
                  <div className="benefit-badge" aria-hidden="true">
                    🚀
                  </div>
                  <div>
                    <h3 className="benefit-title">
                      Mantienes la motivación cada semana
                    </h3>
                    <p className="benefit-desc">
                      Convertir unos minutos al día en un reto entretenido
                      despierta la curiosidad de niños y jóvenes y hace que
                      quieran volver a practicar.
                    </p>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section
          className="section section--warm"
          id="personalizada"
          aria-labelledby="personalizada-heading"
        >
          <div className="container">
            <div className="section-header">
              <span className="kicker">
                Acompañamiento real · Estudiante y profesora
              </span>
              <h2 className="section-title" id="personalizada-heading">
                Una educación más personalizada
              </h2>
              <p className="section-lead">
                En Upward English no estudias frente a una máquina fría: tu
                profesora acompaña tu proceso de cerca, escucha tu progreso y
                adapta el apoyo a lo que realmente necesitas para avanzar.
              </p>
            </div>

            <div className="personal-layout">
              <article
                className="personal-postcard"
                aria-label="Ejemplo de retroalimentación personal de la profesora"
              >
                <div className="postcard-head">
                  <span className="teacher-avatar" aria-hidden="true">
                    CR
                  </span>
                  <div>
                    <strong className="postcard-head__title">
                      Tu profesora siempre presente
                    </strong>
                    <span className="postcard-head__sub">
                      Trato cercano en cada entrega
                    </span>
                  </div>
                </div>

                <blockquote className="postcard-quote">
                  «¡Qué gran historia grabaste esta semana! Tu pronunciación
                  mejoró muchísimo. Repasa cómo suenan los verbos en pasado y te
                  dejo abierto un nuevo intento si quieres subir todavía más tu
                  resultado.»
                </blockquote>

                <div
                  className="sticker-row"
                  role="group"
                  aria-label="Stickers de motivación docente"
                >
                  <span className="sticker-pill">🌟 ¡Excelente trabajo!</span>
                  <span className="sticker-pill">
                    🎙️ ¡Muy buena pronunciación!
                  </span>
                </div>
              </article>

              <div className="personal-grid">
                <article className="personal-item">
                  <h3>Comentarios hechos para ti</h3>
                  <p>
                    Tu profesora escucha tus audios y lee tus respuestas para
                    darte consejos claros y amables pensados solo para tu avance.
                  </p>
                </article>

                <article className="personal-item">
                  <h3>Stickers que motivan</h3>
                  <p>
                    Cada logro se celebra con mensajes y stickers especiales que
                    refuerzan la confianza al hablar y escribir en inglés.
                  </p>
                </article>

                <article className="personal-item">
                  <h3>Oportunidades para mejorar</h3>
                  <p>
                    Si un tema cuesta un poco más, tu profesora puede darte un
                    nuevo intento para que practiques y superes tu propia marca.
                  </p>
                </article>

                <article className="personal-item">
                  <h3>Adaptado a tu nivel y edad</h3>
                  <p>
                    Progresas de A1 a B2 en un espacio cómodo para tu edad, con
                    seguimiento constante y sin compararte con otros compañeros.
                  </p>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section
          className="section"
          id="como-funciona"
          aria-labelledby="pasos-heading"
        >
          <div className="container">
            <div className="section-header">
              <span className="kicker">Sencillo desde el primer día</span>
              <h2 className="section-title" id="pasos-heading">
                Así empiezas tu aventura en 3 pasos
              </h2>
              <p className="section-lead">
                Entrar a explorar el inglés es rápido, claro y pensado para que
                empieces a disfrutar desde el primer momento.
              </p>
            </div>

            <div className="split-showcase">
              <ol className="steps-list">
                <li className="step-item">
                  <span className="step-num" aria-hidden="true">
                    1
                  </span>
                  <div>
                    <h3 className="step-title">Regístrate</h3>
                    <p className="step-desc">
                      Crea tu cuenta en pocos pasos y prepárate para entrar a tu
                      propio espacio de inglés.
                    </p>
                  </div>
                </li>

                <li className="step-item">
                  <span className="step-num" aria-hidden="true">
                    2
                  </span>
                  <div>
                    <h3 className="step-title">Juega y practica</h3>
                    <p className="step-desc">
                      Diviértete con juegos interactivos, graba tu voz y
                      completa retos cortos a tu ritmo.
                    </p>
                  </div>
                </li>

                <li className="step-item">
                  <span className="step-num" aria-hidden="true">
                    3
                  </span>
                  <div>
                    <h3 className="step-title">Aprende y crece</h3>
                    <p className="step-desc">
                      Recibe apoyo cercano, colecciona estrellas e insignias y
                      nota cómo mejora tu inglés cada semana.
                    </p>
                  </div>
                </li>
              </ol>

              <div className="art-frame art-frame--feature">
                <img
                  src="/landing/speaking-journey.png"
                  width={1200}
                  height={896}
                  loading="lazy"
                  decoding="async"
                  alt="Ilustración de un estudiante sonriente con tableta practicando inglés con un micrófono de ondas cálidas, rodeado de estrellas, escudo dorado e insignias mientras el Zorro Explorador lo anima"
                />
              </div>
            </div>

            <div
              className="trust-strip"
              role="region"
              aria-label="Compromisos de tranquilidad para familias y estudiantes"
            >
              <div className="trust-item">
                <span className="trust-dot" aria-hidden="true">
                  ✓
                </span>
                <span>Cero anuncios y cero distracciones externas</span>
              </div>
              <div className="trust-item">
                <span className="trust-dot" aria-hidden="true">
                  ✓
                </span>
                <span>Sin rankings que presionen ni comparen a los niños</span>
              </div>
              <div className="trust-item">
                <span className="trust-dot" aria-hidden="true">
                  ✓
                </span>
                <span>
                  Funciona en celular, tablet o computador desde el navegador
                </span>
              </div>
              <div className="trust-item">
                <span className="trust-dot" aria-hidden="true">
                  ✓
                </span>
                <span>Acompañamiento cercano y personal de tu profesora</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="cta-final-heading">
          <div className="container">
            <div className="cta-banner">
              <h2 id="cta-final-heading">
                ¿Listo para descubrir cuánto inglés puedes aprender jugando?
              </h2>
              <p>
                Crea tu cuenta en menos de un minuto o entra si ya tienes
                usuario activo con tu profesora.
              </p>
              <div className="cta-banner__actions">
                <Link href="/registro" className="btn btn--yellow btn--lg">
                  Crear mi cuenta
                </Link>
                <Link href="/login" className="btn btn--dark-ghost btn--lg">
                  Ya tengo cuenta
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="pie-pagina">
        <div className="container">
          <div className="footer-grid">
            <div>
              <div className="footer-brand">
                <span className="brand-emblem" aria-hidden="true">
                  <UpwardCompassEmblem size={26} />
                </span>
                <div>
                  <div className="footer-brand__title">Upward English</div>
                  <div className="footer-brand__motto">
                    Explora, habla y descubre tu inglés
                  </div>
                </div>
              </div>
              <p className="footer-note">
                Plataforma web diseñada para que niños y jóvenes de 7 a 14 años
                practiquen inglés con juegos, actividades de voz y acompañamiento
                docente real.
              </p>
            </div>

            <div>
              <h3 className="footer-heading">Explora</h3>
              <ul className="footer-links">
                <li>
                  <a className="footer-link" href="#que-es">
                    Qué es Upward English
                  </a>
                </li>
                <li>
                  <a className="footer-link" href="#juegos">
                    Aprender jugando
                  </a>
                </li>
                <li>
                  <a className="footer-link" href="#personalizada">
                    Educación personalizada
                  </a>
                </li>
                <li>
                  <a className="footer-link" href="#como-funciona">
                    Cómo empezar
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="footer-heading">Mi cuenta</h3>
              <ul className="footer-links">
                <li>
                  <Link className="footer-link" href="/registro">
                    Crear cuenta
                  </Link>
                </li>
                <li>
                  <Link className="footer-link" href="/login">
                    Iniciar sesión
                  </Link>
                </li>
                <li>
                  <Link className="footer-link" href="/recuperar-contrasena">
                    Recuperar contraseña
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="footer-heading">Niveles y confianza</h3>
              <ul className="footer-links">
                <li>
                  <span className="footer-note footer-note--item">
                    Niveles MCER A1 · A2 · B1 · B2
                  </span>
                </li>
                <li>
                  <Link className="footer-link" href="/terminos">
                    Términos y condiciones
                  </Link>
                </li>
                <li>
                  <span className="footer-note footer-note--item">
                    Plataforma educativa sin publicidad
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© 2026 Upward English · Aprende inglés explorando</span>
            <span>
              Disponible desde cualquier navegador · Sin descargas obligatorias
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
