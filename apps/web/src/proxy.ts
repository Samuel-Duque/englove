import { NextRequest, NextResponse } from 'next/server';

/**
 * Extracts the user role from a JWT payload without cryptographic verification (Decision A45 & A75).
 * Only used for perimeter UI routing/redirection in proxy.ts; business authorization remains in NestJS.
 */
function extractRoleFromJwt(token: string): string | null {
  try {
    const parts = token.split('.');
    const part1 = parts[1];
    if (!part1) return null;
    const base64 = part1.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = Buffer.from(base64, 'base64').toString('utf8');
    const payload = JSON.parse(jsonStr) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

/**
 * Next.js 16 proxy convention (replacing legacy middleware.ts, Decision 81 & 85).
 * Rule G-B03: Runs in Node.js runtime and ONLY inspects cookie presence / decoded role to redirect.
 * It never authorizes business logic or validates JWT cryptographic signatures.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Static assets and operational endpoints pass through directly
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/icons/') ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    /\.(?:ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot|webp|map|txt|webmanifest|json)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Session cookie detection (with prefix convention, Decision 58)
  const cookiePrefix = process.env.COOKIE_PREFIX || 'englove_';
  const sessionCookie =
    request.cookies.get(`${cookiePrefix}access_token`) ||
    request.cookies.get('access_token') ||
    request.cookies.get('englove_access_token') ||
    request.cookies.get('englove_session');

  const isPublicAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/registro') ||
    pathname.startsWith('/recuperar') ||
    pathname.startsWith('/restablecer');

  const isPublicRoute =
    pathname === '/' ||
    pathname === '/offline' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/icons/') ||
    isPublicAuthRoute;

  // If unauthenticated and attempting private route, redirect to login with safe next parameter (RF-17)
  if (!sessionCookie && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    if (
      pathname.startsWith('/') &&
      !pathname.startsWith('//') &&
      !pathname.includes('\\') &&
      !isPublicAuthRoute
    ) {
      const search = request.nextUrl.search || '';
      loginUrl.searchParams.set('next', `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated and visiting root or public auth routes, redirect to /inicio (H11)
  if (sessionCookie && (isPublicAuthRoute || pathname === '/')) {
    return NextResponse.redirect(new URL('/inicio', request.url));
  }

  // Role segregation redirection (Decisions A45, A75, H9)
  if (sessionCookie) {
    const role = extractRoleFromJwt(sessionCookie.value);
    if (role === 'student') {
      const isTeacherRoute =
        pathname === '/alumnos' ||
        pathname.startsWith('/alumnos/') ||
        pathname === '/actividades' ||
        pathname.startsWith('/actividades/') ||
        pathname === '/asignaciones' ||
        pathname.startsWith('/asignaciones/') ||
        pathname === '/revision' ||
        pathname.startsWith('/revision/') ||
        pathname === '/estadisticas' ||
        pathname.startsWith('/estadisticas/') ||
        pathname === '/grupos' ||
        pathname.startsWith('/grupos/') ||
        pathname === '/contenidos' ||
        pathname.startsWith('/contenidos/');
      if (isTeacherRoute) {
        return NextResponse.redirect(new URL('/inicio', request.url));
      }
    } else if (role === 'teacher') {
      const isStudentRoute =
        pathname === '/perfil' ||
        pathname.startsWith('/perfil/') ||
        pathname === '/progreso' ||
        pathname.startsWith('/progreso/') ||
        pathname === '/juegos' ||
        pathname.startsWith('/juegos/') ||
        pathname === '/feedback' ||
        pathname.startsWith('/feedback/') ||
        pathname === '/actividad' ||
        pathname.startsWith('/actividad/');
      if (isStudentRoute) {
        return NextResponse.redirect(new URL('/inicio', request.url));
      }
    }
  }

  return NextResponse.next();
}
