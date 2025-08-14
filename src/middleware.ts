import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  // Public paths that don't require authentication
  const publicPaths = [
    '/login',
    '/register',
    '/api/auth',
    '/api/health',
    '/api/create-user',
    '/api/create-tables',
    '/api/extend-file-schema',
    '/api/create-results-schema',
    '/api/create-evaluation-schema',
    '/api/deploy-complete-schema',
    '/api/deploy-basic-schema',
    '/api/deploy-schema',
    '/api/check-schema',
    '/api/test-tables',
    '/api/test-sql-server',
    '/api/debug-schema',
    '/api/debug-permissions',
    '/'
  ]
  
  // Check if the current path is public
  const isPublicPath = publicPaths.some(publicPath => 
    path === publicPath || path.startsWith(`${publicPath}/`)
  )
  
  if (isPublicPath) {
    return NextResponse.next()
  }
  
  // Check for authentication session
  const hasSession = checkForAuthSession(request)
  
  if (!hasSession) {
    // Redirect to login if not authenticated
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', path)
    return NextResponse.redirect(loginUrl)
  }
  
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