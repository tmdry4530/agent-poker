import { NextRequest, NextResponse } from 'next/server';

/**
 * Admin UI middleware: protects all /api/admin/* routes with API key auth.
 * In production, ADMIN_API_KEY must be set or all admin API requests are denied.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect admin API routes
  if (!pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }

  const adminApiKey = process.env.ADMIN_API_KEY;

  // In production, ADMIN_API_KEY must be configured
  if (!adminApiKey) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'ADMIN_API_KEY not configured. Admin API is disabled.' },
        { status: 503 },
      );
    }
    // In development, allow unauthenticated access
    return NextResponse.next();
  }

  // Check for API key in header
  const providedKey =
    request.headers.get('x-admin-api-key') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!providedKey || providedKey !== adminApiKey) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/admin/:path*',
};
