import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js 16 proxy convention (replacing legacy middleware.ts, Decision 81 & 85).
 * Rule G-B03: Runs in Node.js runtime and ONLY inspects cookie presence to redirect.
 * It never authorizes business logic or validates JWT cryptographic signatures.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Static assets and operational endpoints pass through directly
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    /\.(?:ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot|webp|map|txt)$/i.test(pathname)
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
    pathname.startsWith('/recuperar-contrasena') ||
    pathname.startsWith('/restablecer');

  const isPublicRoute = pathname === '/' || isPublicAuthRoute;

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

  // If authenticated and attempting public auth route, redirect to role destination or /inicio
  if (sessionCookie && isPublicAuthRoute) {
    return NextResponse.redirect(new URL('/inicio', request.url));
  }

  return NextResponse.next();
}
