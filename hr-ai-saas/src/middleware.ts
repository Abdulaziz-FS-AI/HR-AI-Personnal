import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // TEMPORARILY DISABLED - ALLOW ALL REQUESTS
  return NextResponse.next()
}

/**
 * Check for authentication session with enhanced cookie detection
 */
function checkForAuthSession(request: NextRequest): boolean {
  // List of possible NextAuth session cookie names
  const sessionCookieNames = [
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    // Legacy names
    'next-auth.session-token.0',
    'next-auth.session-token.1'
  ]
  
  // Check if any of these session cookies exist and have content
  for (const cookieName of sessionCookieNames) {
    const cookie = request.cookies.get(cookieName)
    if (cookie && cookie.value && cookie.value.length > 10) {
      return true
    }
  }
  
  return false
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}