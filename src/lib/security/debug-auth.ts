import { NextRequest, NextResponse } from 'next/server'

/**
 * Secure debug endpoints with API key or admin authentication
 */
export function withDebugAuth(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Check for debug API key
    const debugKey = request.headers.get('x-debug-key')
    const validDebugKey = process.env.DEBUG_API_KEY
    
    // Check for admin session
    const adminHeader = request.headers.get('x-admin-session')
    
    // Allow in development
    if (process.env.NODE_ENV === 'development') {
      return handler(request)
    }
    
    // Require auth in production
    if (!debugKey && !adminHeader) {
      return NextResponse.json(
        { error: 'Debug endpoints require authentication' },
        { status: 401 }
      )
    }
    
    // Validate debug key
    if (debugKey && validDebugKey && debugKey === validDebugKey) {
      return handler(request)
    }
    
    // Validate admin session (implement your admin check here)
    if (adminHeader) {
      // Add your admin validation logic
      return handler(request)
    }
    
    return NextResponse.json(
      { error: 'Invalid debug credentials' },
      { status: 403 }
    )
  }
}

/**
 * Rate limit debug endpoints to prevent abuse
 */
export function withDebugRateLimit(handler: (request: NextRequest) => Promise<NextResponse>) {
  const requestCounts = new Map<string, { count: number; resetTime: number }>()
  
  return async (request: NextRequest): Promise<NextResponse> => {
    const ip = request.ip || 'unknown'
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute
    const maxRequests = 10 // 10 requests per minute for debug endpoints
    
    const current = requestCounts.get(ip)
    
    if (!current || now > current.resetTime) {
      requestCounts.set(ip, { count: 1, resetTime: now + windowMs })
      return handler(request)
    }
    
    if (current.count >= maxRequests) {
      return NextResponse.json(
        { error: 'Rate limit exceeded for debug endpoint' },
        { status: 429 }
      )
    }
    
    current.count++
    return handler(request)
  }
}