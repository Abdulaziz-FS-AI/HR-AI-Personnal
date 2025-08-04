import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/api/auth', '/api/health', '/api/deploy-schema']
  
  // Check if the request is for a public route
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  // Check if user has auth session
  const hasAuthSession = request.cookies.has('authjs.session-token') || 
                        request.cookies.has('__Secure-authjs.session-token')
  
  // Redirect unauthenticated users to login
  if (!isPublicRoute && !hasAuthSession) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // Redirect authenticated users from login/register to dashboard
  if (hasAuthSession && (pathname === '/login' || pathname === '/register')) {
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