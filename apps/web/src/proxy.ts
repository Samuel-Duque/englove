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
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Session cookie detection (with prefix convention, Decision 58)
  const sessionCookie = request.cookies.get('englove_session') || request.cookies.get('access_token');

  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/registro') ||
    pathname.startsWith('/recuperar-contrasena') ||
    pathname.startsWith('/restablecer');

  // If unauthenticated and attempting private route, redirect to login
  if (!sessionCookie && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
