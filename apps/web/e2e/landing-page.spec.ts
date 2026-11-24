import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';

interface CollectedErrors {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  httpErrors: string[];
}

function attachErrorListeners(page: Page): CollectedErrors {
  const errors: CollectedErrors = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    httpErrors: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    if (!err.message.includes('cache-bypass')) {
      errors.pageErrors.push(err.message);
    }
  });

  page.on('requestfailed', (req) => {
    const failureText = req.failure()?.errorText ?? 'unknown failure';
    if (!failureText.includes('ERR_ABORTED')) {
      errors.failedRequests.push(`${req.method()} ${req.url()} (${failureText})`);
    }
  });

  page.on('response', (res) => {
    const status = res.status();
    const url = res.url();
    if (status >= 400 && !url.includes('favicon')) {
      errors.httpErrors.push(`${status} ${url}`);
    }
  });

  return errors;
}

function assertNoPageErrors(errors: CollectedErrors): void {
  expect(errors.httpErrors, `HTTP >=400 responses: ${errors.httpErrors.join('; ')}`).toEqual([]);
  expect(errors.failedRequests, `Failed requests: ${errors.failedRequests.join('; ')}`).toEqual([]);
  expect(errors.pageErrors, `Page errors: ${errors.pageErrors.join('; ')}`).toEqual([]);
  expect(errors.consoleErrors, `Console errors: ${errors.consoleErrors.join('; ')}`).toEqual([]);
}

test.describe('Landing Page Pública de Upward English', () => {
  test('1. Estructura completa, cabecera, imágenes, emblema, tokens, tipografía y exclusiones', async ({
    page,
    baseURL,
  }) => {
    const errors = attachErrorListeners(page);
    const response = await page.goto('/', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    expect(response).not.toBeNull();
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page).toHaveTitle(/Upward English/);

    // Sin elementos de prototipo ni bloques obsoletos
    await expect(page.locator('.studio-bar')).toHaveCount(0);
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('.hero-pills')).toHaveCount(0);
    await expect(page.locator('.brand-sub')).toHaveCount(0);
    await expect(page.locator('#pruebalo')).toHaveCount(0);
    await expect(page.locator('#kids-y-teens')).toHaveCount(0);
    await expect(page.locator('.challenge-card')).toHaveCount(0);
    await expect(page.locator('.microgames-explorer')).toHaveCount(0);
    await expect(page.locator('.age-comparator')).toHaveCount(0);
    await expect(page.locator('a[href="#main-content"]')).toHaveCount(1);

    // Bloque 1: Cabecera sticky con 4 anclas + Entrar + Crear mi cuenta
    const headerNavLinks = page.locator('.header-nav a');
    await expect(headerNavLinks).toHaveCount(4);
    const expectedAnchors = [
      { href: '#que-es', label: 'Qué es' },
      { href: '#juegos', label: 'Juegos' },
      { href: '#personalizada', label: 'Personalizada' },
      { href: '#como-funciona', label: 'Cómo empezar' },
    ];
    for (const [index, anchor] of expectedAnchors.entries()) {
      const link = headerNavLinks.nth(index);
      await expect(link).toHaveText(anchor.label);
      await expect(link).toHaveAttribute('href', anchor.href);
    }
    await expect(page.locator('.header-actions a[href="/login"]')).toHaveText('Entrar');
    await expect(page.locator('.header-actions a[href="/registro"]')).toHaveText('Crear mi cuenta');

    // Bloque 2: Hero (#inicio)
    const h1 = page.locator('h1');
    await expect(h1).toHaveText('Aprende inglés jugando, hablando y descubriendo nuevas palabras');
    const heroPrimary = page.locator('.hero-cta-row a[href="/registro"]');
    const heroSecondary = page.locator('.hero-cta-row a[href="#juegos"]');
    await expect(heroPrimary).toHaveText('Empezar mi aventura');
    await expect(heroSecondary).toHaveText('Descubre los juegos');
    const heroPrimaryBox = await heroPrimary.boundingBox();
    const heroSecondaryBox = await heroSecondary.boundingBox();
    expect(heroPrimaryBox?.height ?? 0).toBeGreaterThanOrEqual(54);
    expect(heroSecondaryBox?.height ?? 0).toBeGreaterThanOrEqual(54);

    // Bloque 3: #que-es (3 pilares)
    const queEs = page.locator('#que-es');
    await expect(queEs.locator('h2')).toHaveText('¿Qué hace especial a Upward English?');
    await expect(queEs.locator('.pillar-card')).toHaveCount(3);

    // Bloque 4: #juegos (ilustración + 3 tarjetas de beneficios)
    const juegos = page.locator('#juegos');
    await expect(juegos.locator('h2')).toHaveText(
      'Aprende inglés jugando, sin presión y con ganas de volver',
    );
    await expect(juegos.locator('.benefit-card')).toHaveCount(3);

    // Bloque 5: #personalizada (postal docente + blockquote + 2 stickers + rejilla 2x2)
    const personalizada = page.locator('#personalizada');
    await expect(personalizada.locator('h2')).toHaveText('Una educación más personalizada');
    await expect(personalizada.locator('.personal-postcard')).toHaveCount(1);
    await expect(personalizada.locator('blockquote.postcard-quote')).toBeVisible();
    await expect(personalizada.locator('.sticker-pill')).toHaveCount(2);
    await expect(personalizada.locator('.personal-item')).toHaveCount(4);

    // Bloque 6: #como-funciona (3 pasos + franja de tranquilidad con 4 garantías)
    const comoFunciona = page.locator('#como-funciona');
    await expect(comoFunciona.locator('h2')).toHaveText('Así empiezas tu aventura en 3 pasos');
    await expect(comoFunciona.locator('.step-item')).toHaveCount(3);
    await expect(comoFunciona.locator('.trust-item')).toHaveCount(4);

    // Bloque 7a: Banner CTA final oscuro
    const ctaBanner = page.locator('.cta-banner');
    await expect(ctaBanner.locator('h2')).toHaveText(
      '¿Listo para descubrir cuánto inglés puedes aprender jugando?',
    );
    await expect(ctaBanner.locator('a[href="/registro"]')).toHaveText('Crear mi cuenta');
    await expect(ctaBanner.locator('a[href="/login"]')).toHaveText('Ya tengo cuenta');

    // Bloque 7b: Footer de 4 columnas
    const footer = page.locator('footer.site-footer#pie-pagina');
    await expect(footer).toBeVisible();
    await expect(footer.locator('.footer-grid > div')).toHaveCount(4);
    await expect(footer.locator('a[href="/registro"]')).toBeVisible();
    await expect(footer.locator('a[href="/login"]')).toBeVisible();
    await expect(footer.locator('a[href="/recuperar-contrasena"]')).toBeVisible();
    await expect(footer.locator('a[href="/terminos"]')).toBeVisible();
    await expect(footer).toContainText('Niveles MCER A1 · A2 · B1 · B2');
    await expect(footer).toContainText('Plataforma educativa sin publicidad');

    // Las 3 imágenes editoriales cargan correctamente (incluyendo lazy al hacer scroll)
    const imagePaths = [
      '/landing/hero-expedition.png',
      '/landing/games-adventure.png',
      '/landing/speaking-journey.png',
    ];
    for (const imgPath of imagePaths) {
      const img = page.locator(`img[src="${imgPath}"]`);
      await expect(img).toBeVisible();
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(
          () =>
            img.evaluate((node) => {
              if (!(node instanceof HTMLImageElement)) return false;
              return node.complete && node.naturalWidth > 0;
            }),
          { timeout: 10_000 },
        )
        .toBe(true);
      const altText = await img.getAttribute('alt');
      expect(altText?.trim().length ?? 0).toBeGreaterThan(20);
    }

    // Emblema SVG de Brújula Ascendente Upward presente en cabecera (.brand-emblem) y footer
    const headerLogoSvg = page.locator('.site-header .brand-emblem svg');
    const footerLogoSvg = page.locator('.site-footer .brand-emblem svg');
    await expect(headerLogoSvg).toBeVisible();
    await expect(footerLogoSvg).toBeVisible();
    const headerEmblemBox = await page.locator('.site-header .brand-emblem').boundingBox();
    expect(headerEmblemBox?.width ?? 0).toBeGreaterThanOrEqual(42);
    expect(headerEmblemBox?.height ?? 0).toBeGreaterThanOrEqual(42);

    // Tokens visuales, colores de marca y tipografía
    const styles = await page.evaluate(() => {
      const root = document.querySelector('.upward-landing');
      const headerCta = document.querySelector('.header-actions a[href="/registro"]');
      const heroPrimaryEl = document.querySelector('.hero-cta-row a[href="/registro"]');
      const heroSecondaryEl = document.querySelector('.hero-cta-row a[href="#juegos"]');
      const bannerEl = document.querySelector('.cta-banner');
      const footerEl = document.querySelector('.site-footer');
      const h1El = document.querySelector('.hero-title');
      const uiBtn = document.querySelector('.header-actions .btn');

      const htmlStyle = getComputedStyle(document.documentElement);
      return {
        landingBg: root ? getComputedStyle(root).backgroundColor : '',
        landingBodyFont: root ? getComputedStyle(root).fontFamily : '',
        h1Font: h1El ? getComputedStyle(h1El).fontFamily : '',
        uiFont: uiBtn ? getComputedStyle(uiBtn).fontFamily : '',
        varDisplay: htmlStyle.getPropertyValue('--font-upward-display').trim(),
        varBody: htmlStyle.getPropertyValue('--font-upward-body').trim(),
        varUi: htmlStyle.getPropertyValue('--font-upward-ui').trim(),
        headerCtaBg: headerCta ? getComputedStyle(headerCta).backgroundColor : '',
        heroPrimaryBg: heroPrimaryEl ? getComputedStyle(heroPrimaryEl).backgroundColor : '',
        heroSecondaryBg: heroSecondaryEl ? getComputedStyle(heroSecondaryEl).backgroundColor : '',
        bannerBgImage: bannerEl ? getComputedStyle(bannerEl).backgroundImage : '',
        footerBg: footerEl ? getComputedStyle(footerEl).backgroundColor : '',
      };
    });

    expect(styles.landingBg).toBe('rgb(255, 249, 236)'); // #FFF9EC
    expect(styles.headerCtaBg).toBe('rgb(198, 71, 11)'); // #C6470B
    expect(styles.heroPrimaryBg).toBe('rgb(185, 37, 29)'); // #B9251D
    expect(styles.heroSecondaryBg).toBe('rgb(255, 202, 58)'); // #FFCA3A
    expect(styles.bannerBgImage).toContain('rgb(43, 21, 10)'); // #2B150A
    expect(styles.bannerBgImage).toContain('rgb(62, 32, 17)'); // #3E2011
    expect(styles.footerBg).toBe('rgb(35, 18, 9)'); // #231209

    expect(styles.varDisplay.length > 0 || /bricolage/i.test(styles.h1Font)).toBe(true);
    expect(styles.varBody.length > 0 || /nunito/i.test(styles.landingBodyFont)).toBe(true);
    expect(styles.varUi.length > 0 || /jakarta/i.test(styles.uiFont)).toBe(true);
    expect(styles.h1Font.toLowerCase()).toMatch(/bricolage/);
    expect(styles.landingBodyFont.toLowerCase()).toMatch(/nunito/);
    expect(styles.uiFont.toLowerCase()).toMatch(/jakarta/);

    // Verificación de foco visible por teclado en superficie clara (#1D4ED8) y oscura (#FFCA3A)
    await heroPrimary.focus();
    const lightFocus = await heroPrimary.evaluate((el) => {
      const st = getComputedStyle(el);
      return { outlineColor: st.outlineColor, outlineWidth: st.outlineWidth };
    });
    expect(lightFocus.outlineColor).toBe('rgb(29, 78, 216)');
    expect(lightFocus.outlineWidth).toBe('3px');

    const bannerLoginLink = page.locator('.cta-banner a[href="/login"]');
    await bannerLoginLink.scrollIntoViewIfNeeded();
    await bannerLoginLink.focus();
    const darkFocus = await bannerLoginLink.evaluate((el) => {
      const st = getComputedStyle(el);
      return { outlineColor: st.outlineColor, outlineWidth: st.outlineWidth };
    });
    expect(darkFocus.outlineColor).toBe('rgb(255, 202, 58)');
    expect(darkFocus.outlineWidth).toBe('3px');

    // Cero menciones a "microjuegos", jerga técnica ni exclusiones del piloto (CONTEXT.md §2.4)
    const visibleText = await page.locator('body').innerText();
    expect(visibleText).not.toMatch(/microjuegos?/i);
    expect(visibleText).not.toMatch(
      /\b(next\.?js|indexeddb|rbac|backend|base de datos|supabase|postgresql|prisma|vinext|cloudflare)\b/i,
    );
    expect(visibleText).not.toMatch(
      /\b(google play|app store|capacitor|phaser|educaplay|wompi|epayco|stripe|suscripci[oó]n|suscripciones|tarifa|precio|descuento|prueba gratis|cuenta de padres|portal de padres)\b/i,
    );

    if (baseURL) {
      expect(page.url()).toContain(baseURL.replace(/\/$/, ''));
    }
    assertNoPageErrors(errors);
  });

  test('2. Navegación real desde / hacia /login, /registro, /recuperar-contrasena y /terminos (HTTP 200)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const routes = [
      {
        label: 'Entrar',
        scope: '.header-actions',
        expectedPath: '/login',
        expectedHeading: /Upward English/,
      },
      {
        label: 'Empezar mi aventura',
        scope: '.hero-cta-row',
        expectedPath: '/registro',
        expectedHeading: /Crea tu cuenta/,
      },
      {
        label: 'Recuperar contraseña',
        scope: '.site-footer',
        expectedPath: '/recuperar-contrasena',
        expectedHeading: /Recuperar contraseña/,
      },
      {
        label: 'Términos y condiciones',
        scope: '.site-footer',
        expectedPath: '/terminos',
        expectedHeading: /Términos y Condiciones de Uso/,
      },
    ];

    for (const item of routes) {
      const errors = attachErrorListeners(page);
      await page.goto('/', { waitUntil: 'load' });
      const link = page.locator(item.scope).getByRole('link', { name: item.label });
      await link.scrollIntoViewIfNeeded();
      await link.click();
      await page.waitForURL(new RegExp(`${item.expectedPath}$`), { timeout: 20_000 });
      await expect(page.locator('h1')).toContainText(item.expectedHeading);

      const docRes = await page.request.get(item.expectedPath);
      expect(docRes.status()).toBe(200);
      assertNoPageErrors(errors);
    }
  });

  test('3. Flujo real /inicio + /login + proxy.ts contra API local y PostgreSQL Docker', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const healthRes = await page.request.get(`${apiUrl}/health`);
    expect(healthRes.status(), 'Local API /health debe estar activa en el puerto 3001').toBe(200);

    const errors = attachErrorListeners(page);

    // 3.1 /inicio sin sesión redirige a /login?next=%2Finicio
    await page.goto('/inicio', { waitUntil: 'load' });
    await expect(page).toHaveURL(/\/login\?next=%2Finicio/);

    // 3.2 Login real con usuario seed en Docker Postgres -> redirige a /inicio (HTTP 200)
    await page.fill('input[type="email"]', 'lucas.kids@upwardenglish.org');
    await page.fill('input[type="password"]', 'Estudiante2026!');

    const [loginResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/v1/auth/login') && res.request().method() === 'POST',
      ),
      page.click('button[type="submit"]'),
    ]);
    expect(loginResponse.status()).toBe(200);

    await page.waitForURL(/\/inicio$/, { timeout: 20_000 });
    await expect(page.locator('h1')).toContainText('¡Hola, Lucas Diaz!', { timeout: 15_000 });

    // 3.3 Navegar a / estando autenticado redirige a /inicio (proxy.ts)
    const rootRedirectRes = await page.goto('/', { waitUntil: 'load' });
    expect(rootRedirectRes?.status()).toBe(200);
    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.locator('h1')).toContainText('¡Hola, Lucas Diaz!', { timeout: 15_000 });

    assertNoPageErrors(errors);

    // Cierre de sesión limpio para no dejar cookies activas
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
  });

  test('4. Layout responsive (1280x900, 800x1280, 390x844), menú móvil, objetivos táctiles >=48px, axe WCAG 2.2 AA y capturas', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const screenshotDir = process.env.LANDING_SCREENSHOT_DIR;
    const viewports = [
      { name: 'desktop', width: 1280, height: 900, file: 'landing-desktop.png' },
      { name: 'tablet', width: 800, height: 1280, file: 'landing-tablet.png' },
      { name: 'mobile', width: 390, height: 844, file: 'landing-mobile.png' },
    ] as const;

    for (const vp of viewports) {
      const errors = attachErrorListeners(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/', { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);

      // Cero desbordamiento horizontal
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

      // Objetivos táctiles >= 48px en controles principales, enlaces de cabecera y footer
      const touchSelectors = [
        '.header-nav a',
        '.header-actions a',
        '.hero-cta-row a',
        '.cta-banner__actions a',
        '.footer-link',
      ];
      for (const selector of touchSelectors) {
        const elements = page.locator(selector);
        const count = await elements.count();
        for (let i = 0; i < count; i++) {
          const el = elements.nth(i);
          if (await el.isVisible()) {
            const box = await el.boundingBox();
            expect(box, `${selector}[${i}] boundingBox`).not.toBeNull();
            expect(box?.height ?? 0, `${selector}[${i}] height at ${vp.name}`).toBeGreaterThanOrEqual(48);
            expect(box?.width ?? 0, `${selector}[${i}] width at ${vp.name}`).toBeGreaterThanOrEqual(48);
          }
        }
      }

      if (vp.name === 'desktop' || vp.name === 'tablet') {
        // En escritorio (1280) y tablet (800 > 680) se conserva cabecera horizontal compacta
        await expect(page.locator('.header-nav')).toBeVisible();
        await expect(page.locator('.header-actions')).toBeVisible();
        await expect(page.locator('#mobile-menu-btn')).toBeHidden();

        if (screenshotDir) {
          await page.screenshot({
            path: path.join(screenshotDir, vp.file),
            fullPage: false,
          });
        }
      } else {
        // Móvil (390 <= 680): oculta nav/acciones de escritorio y muestra #mobile-menu-btn >= 48x48
        await expect(page.locator('.header-nav')).toBeHidden();
        await expect(page.locator('.header-actions')).toBeHidden();
        const menuBtn = page.locator('#mobile-menu-btn');
        await expect(menuBtn).toBeVisible();
        const menuBox = await menuBtn.boundingBox();
        expect(menuBox?.width ?? 0).toBeGreaterThanOrEqual(48);
        expect(menuBox?.height ?? 0).toBeGreaterThanOrEqual(48);
        await expect(menuBtn).toHaveAttribute('aria-expanded', 'false');

        // Captura de ventana completa antes de abrir el menú móvil
        if (screenshotDir) {
          await page.screenshot({
            path: path.join(screenshotDir, vp.file),
            fullPage: false,
          });
        }

        await menuBtn.click();
        await expect(menuBtn).toHaveAttribute('aria-expanded', 'true');
        const mobileNav = page.locator('#mobile-menu-panel');
        await expect(mobileNav).toBeVisible();
        await expect(mobileNav.locator('a[href^="#"]')).toHaveCount(4);
        await expect(mobileNav.getByRole('link', { name: 'Entrar' })).toBeVisible();
        await expect(mobileNav.getByRole('link', { name: 'Crear mi cuenta' })).toBeVisible();

        const openOverflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(openOverflow.scrollWidth).toBeLessThanOrEqual(openOverflow.clientWidth);

        await page.keyboard.press('Escape');
        await expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
        await expect(mobileNav).toBeHidden();
      }

      // Auditoría WCAG 2.2 AA con @axe-core/playwright en cada viewport
      const axeResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        axeResults.violations,
        `Axe violations at ${vp.name}: ${JSON.stringify(axeResults.violations, null, 2)}`,
      ).toEqual([]);

      assertNoPageErrors(errors);
    }
  });
});
