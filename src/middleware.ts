import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Public routes that don't require authentication
  const publicRoutes = [
    '/login', 
    '/register', 
    '/api/auth', 
    '/api/health', 
    '/api/deploy-schema',
    '/api/check-schema',
    '/api/test-db',
    '/api/debug-auth',
    '/api/test-imports',
    '/api/simple-eval-test'
  ]
  
  // Check if the request is for a public route
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  // Enhanced session detection - check for all possible NextAuth cookie variants
  const hasAuthSession = checkForAuthSession(request)
  
  // Always allow access to public routes
  if (isPublicRoute) {
    return NextResponse.next()
  }
  
  // For protected routes, redirect to login if no session
  if (!hasAuthSession) {
    // Add current path as redirect parameter
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/login') {
      loginUrl.searchParams.set('callbackUrl', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }
  
  // Redirect authenticated users from login/register to dashboard
  if (hasAuthSession && (pathname === '/login' || pathname === '/register')) {
    // Check for callback URL
    const callbackUrl = request.nextUrl.searchParams.get('callbackUrl')
    if (callbackUrl && callbackUrl !== '/login' && callbackUrl !== '/register') {
      return NextResponse.redirect(new URL(callbackUrl, request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  
  // Redirect root to appropriate page
  if (pathname === '/') {
    if (hasAuthSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    } else {
      return NextResponse.redirect(new URL('/login', request.url))
    }
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