import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/features',
  '/why-nucleus',
  '/docs',
  '/contact',
  '/403',
  '/favicon.ico',
  '/manifest.json',
  '/robots.txt',
]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public static assets and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/api') ||
    PUBLIC_PATHS.has(pathname)
  ) {
    return NextResponse.next();
  }

  // 2. Check for active session cookie
  // Better Auth session cookie (cookiePrefix "mkraft"; "__Secure-" on HTTPS). Presence only gates
  // navigation; every API call validates the session itself.
  const sessionCookie =
    request.cookies.get('mkraft.session_token')?.value ||
    request.cookies.get('__Secure-mkraft.session_token')?.value;

  // 3. For protected routes (like /workspace and /admin), if no session cookie exists, redirect to /login
  if ((pathname.startsWith('/workspace') || pathname.startsWith('/admin') || pathname.startsWith('/platform')) && !sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
