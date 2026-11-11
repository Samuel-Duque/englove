import { NextRequest, NextResponse } from 'next/server';

interface DecodedJwt {
  role?: string;
  exp?: number;
  typ?: string;
}

/**
 * Extracts payload fields from a JWT payload without cryptographic verification (Decision A45 & A75).
 * Only used for perimeter UI routing/redirection in proxy.ts; business authorization remains in NestJS.
 */
function decodeJwtPayload(token: string): DecodedJwt | null {
  try {
    const parts = token.split('.');
    const part1 = parts[1];
    if (!part1) return null;
    const base64 = part1.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = Buffer.from(base64, 'base64').toString('utf8');
    const parsed: unknown = JSON.parse(jsonStr);
    const rec = typeof parsed === 'object' && parsed !== null ? parsed : {};
    const roleVal = Reflect.get(rec, 'role');
    const expVal = Reflect.get(rec, 'exp');
    const typVal = Reflect.get(rec, 'typ');
    return {
      role: typeof roleVal === 'string' ? roleVal : undefined,
      exp: typeof expVal === 'number' ? expVal : undefined,
      typ: typeof typVal === 'string' ? typVal : undefined,
    };
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
    pathname === '/sw.js' ||
    /\.(?:ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot|webp|map|txt|webmanifest|json)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Session cookie detection: strictly with prefix convention (Decision 58, RF-2)
  const cookiePrefix =
    process.env.COOKIE_PREFIX || process.env.NEXT_PUBLIC_COOKIE_PREFIX || 'englove_';
  const sessionCookie = request.cookies.get(`${cookiePrefix}access_token`);

  const jwt = sessionCookie ? decodeJwtPayload(sessionCookie.value) : null;
  const nowSec = Math.floor(Date.now() / 1000);
  const isExpired = Boolean(jwt && typeof jwt.exp === 'number' && jwt.exp <= nowSec);
  const isSessionValid = Boolean(sessionCookie && !isExpired);

  const isPublicAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/registro') ||
    pathname.startsWith('/recuperar') ||
    pathname.startsWith('/restablecer');

  const isPublicRoute =
    pathname === '/' ||
    pathname === '/terminos' ||
    pathname.startsWith('/terminos/') ||
    pathname === '/offline' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/icons/') ||
    isPublicAuthRoute;

  // If unauthenticated and attempting private route, redirect to login with safe next parameter (RF-17)
  if (!isSessionValid && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    const search = request.nextUrl.search || '';
    const nextCandidate = `${pathname}${search}`;
    const hasControlChars = Array.from(nextCandidate).some((c) => {
      const code = c.charCodeAt(0);
      return code <= 31 || code === 127;
    });
    if (
      pathname.startsWith('/') &&
      !pathname.startsWith('//') &&
      !pathname.includes('\\') &&
      !hasControlChars &&
      !isPublicAuthRoute
    ) {
      loginUrl.searchParams.set('next', nextCandidate);
    }
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated and visiting root or public auth routes, redirect to /inicio (H11)
  if (isSessionValid && (isPublicAuthRoute || pathname === '/')) {
    return NextResponse.redirect(new URL('/inicio', request.url));
  }

  // Role segregation redirection (Decisions A45, A75, H9)
  if (isSessionValid && jwt) {
    const role = jwt.role;
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
        pathname === '/contenido-extra' ||
        pathname.startsWith('/contenido-extra/');
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
        pathname.startsWith('/actividad/') ||
        pathname === '/extra' ||
        pathname.startsWith('/extra/');
      if (isStudentRoute) {
        return NextResponse.redirect(new URL('/inicio', request.url));
      }
    }
  }

  return NextResponse.next();
}
