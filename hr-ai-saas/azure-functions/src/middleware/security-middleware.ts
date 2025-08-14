import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { RateLimiterMemory } from 'rate-limiter-flexible'

interface AuthenticatedUser {
  id: string
  email: string
  roles: string[]
  sessionId?: string
}

interface SecurityConfig {
  jwtSecret: string
  rateLimits: {
    api: { windowMs: number; max: number }
    aiApi: { windowMs: number; max: number }
    perUser: { windowMs: number; max: number }
  }
  maxRequestSize: number
  allowedOrigins: string[]
}

class SecurityMiddleware {
  private config: SecurityConfig
  private apiRateLimiter: RateLimiterMemory
  private aiApiRateLimiter: RateLimiterMemory
  private userRateLimiter: RateLimiterMemory

  constructor() {
    this.config = {
      jwtSecret: process.env.JWT_SECRET || '',
      rateLimits: {
        api: { windowMs: 60000, max: 100 }, // 100 requests per minute
        aiApi: { windowMs: 60000, max: 10 }, // 10 AI calls per minute per user
        perUser: { windowMs: 60000, max: 200 } // 200 requests per minute per user
      },
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',')
    }

    if (!this.config.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required')
    }

    // Initialize rate limiters
    this.apiRateLimiter = new RateLimiterMemory({
      keyGenerator: () => 'api-global',
      points: this.config.rateLimits.api.max,
      duration: this.config.rateLimits.api.windowMs / 1000
    })

    this.aiApiRateLimiter = new RateLimiterMemory({
      keyGenerator: (userId: string) => `ai-api-${userId}`,
      points: this.config.rateLimits.aiApi.max,
      duration: this.config.rateLimits.aiApi.windowMs / 1000
    })

    this.userRateLimiter = new RateLimiterMemory({
      keyGenerator: (userId: string) => `user-${userId}`,
      points: this.config.rateLimits.perUser.max,
      duration: this.config.rateLimits.perUser.windowMs / 1000
    })
  }

  /**
   * Complete security middleware - apply to all HTTP endpoints
   */
  async applySecurityMiddleware(
    request: HttpRequest,
    context: InvocationContext,
    options: {
      requireAuth?: boolean
      requireRoles?: string[]
      allowAnonymous?: boolean
      rateLimitType?: 'api' | 'ai-api' | 'user'
    } = {}
  ): Promise<{ user?: AuthenticatedUser; error?: HttpResponseInit }> {
    
    // 1. CORS Check
    const corsError = this.checkCORS(request)
    if (corsError) return { error: corsError }

    // 2. Request Size Check
    const sizeError = this.checkRequestSize(request)
    if (sizeError) return { error: sizeError }

    // 3. Rate Limiting (Global API)
    try {
      await this.apiRateLimiter.consume('api-global')
    } catch (rateLimitError) {
      context.warn('API rate limit exceeded', { ip: this.getClientIP(request) })
      return {
        error: {
          status: 429,
          jsonBody: { 
            error: 'Too many requests',
            retryAfter: rateLimitError.msBeforeNext 
          },
          headers: {
            'Retry-After': Math.ceil(rateLimitError.msBeforeNext / 1000).toString(),
            'X-RateLimit-Limit': this.config.rateLimits.api.max.toString(),
            'X-RateLimit-Remaining': '0'
          }
        }
      }
    }

    // 4. Authentication
    let user: AuthenticatedUser | undefined
    if (!options.allowAnonymous || options.requireAuth) {
      const authResult = await this.authenticateRequest(request, context)
      if (authResult.error) return authResult
      user = authResult.user

      // 5. User-specific Rate Limiting
      if (user && options.rateLimitType === 'user') {
        try {
          await this.userRateLimiter.consume(user.id)
        } catch (rateLimitError) {
          return {
            error: {
              status: 429,
              jsonBody: { error: 'User rate limit exceeded' }
            }
          }
        }
      }

      // 6. AI API Rate Limiting
      if (user && options.rateLimitType === 'ai-api') {
        try {
          await this.aiApiRateLimiter.consume(user.id)
        } catch (rateLimitError) {
          return {
            error: {
              status: 429,
              jsonBody: { 
                error: 'AI API rate limit exceeded',
                message: 'You have reached your AI analysis limit. Please try again later.'
              }
            }
          }
        }
      }

      // 7. Role-based Authorization
      if (options.requireRoles && user) {
        const hasRequiredRole = options.requireRoles.some(role => 
          user.roles.includes(role) || user.roles.includes('admin')
        )
        
        if (!hasRequiredRole) {
          context.warn('Insufficient permissions', { 
            userId: user.id, 
            requiredRoles: options.requireRoles,
            userRoles: user.roles 
          })
          return {
            error: {
              status: 403,
              jsonBody: { error: 'Insufficient permissions' }
            }
          }
        }
      }
    }

    return { user }
  }

  /**
   * Authenticate JWT token from request
   */
  private async authenticateRequest(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<{ user?: AuthenticatedUser; error?: HttpResponseInit }> {
    try {
      const authHeader = request.headers.get('authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
          error: {
            status: 401,
            jsonBody: { error: 'Missing or invalid authorization header' },
            headers: { 'WWW-Authenticate': 'Bearer' }
          }
        }
      }

      const token = authHeader.substring(7)
      
      // Verify JWT
      const decoded = jwt.verify(token, this.config.jwtSecret) as any
      
      // Validate token structure
      if (!decoded.sub || !decoded.email || !decoded.exp) {
        throw new Error('Invalid token structure')
      }

      // Check expiration
      if (decoded.exp < Date.now() / 1000) {
        throw new Error('Token expired')
      }

      const user: AuthenticatedUser = {
        id: decoded.sub,
        email: decoded.email,
        roles: decoded.roles || ['user'],
        sessionId: decoded.sessionId
      }

      // Optional: Validate user still exists in database
      // await this.validateUserExists(user.id)

      context.log('User authenticated', { userId: user.id, email: user.email })
      return { user }

    } catch (error) {
      context.warn('Authentication failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: this.getClientIP(request)
      })
      
      return {
        error: {
          status: 401,
          jsonBody: { 
            error: 'Authentication failed',
            details: error instanceof Error ? error.message : 'Invalid token'
          },
          headers: { 'WWW-Authenticate': 'Bearer' }
        }
      }
    }
  }

  /**
   * Check CORS policy
   */
  private checkCORS(request: HttpRequest): HttpResponseInit | null {
    const origin = request.headers.get('origin')
    const method = request.method

    // Handle preflight requests
    if (method === 'OPTIONS') {
      if (!origin || !this.config.allowedOrigins.includes(origin)) {
        return {
          status: 403,
          jsonBody: { error: 'CORS: Origin not allowed' }
        }
      }

      return {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400'
        }
      }
    }

    // Check origin for regular requests
    if (origin && !this.config.allowedOrigins.includes(origin)) {
      return {
        status: 403,
        jsonBody: { error: 'CORS: Origin not allowed' }
      }
    }

    return null
  }

  /**
   * Check request size limits
   */
  private checkRequestSize(request: HttpRequest): HttpResponseInit | null {
    const contentLength = request.headers.get('content-length')
    
    if (contentLength && parseInt(contentLength, 10) > this.config.maxRequestSize) {
      return {
        status: 413,
        jsonBody: { error: 'Request too large' }
      }
    }

    return null
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: HttpRequest): string {
    return request.headers.get('x-forwarded-for') ||
           request.headers.get('x-real-ip') ||
           request.headers.get('x-client-ip') ||
           'unknown'
  }

  /**
   * Generate secure response headers
   */
  getSecurityHeaders(origin?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Content-Security-Policy': "default-src 'self'",
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }

    // Add CORS headers if origin is allowed
    if (origin && this.config.allowedOrigins.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin
      headers['Access-Control-Allow-Credentials'] = 'true'
    }

    return headers
  }

  /**
   * Log security event
   */
  logSecurityEvent(
    context: InvocationContext,
    event: string,
    details: Record<string, any>
  ): void {
    context.log('SecurityEvent', {
      event,
      timestamp: new Date().toISOString(),
      ...details
    })
  }
}

// Export singleton
export const securityMiddleware = new SecurityMiddleware()

/**
 * Helper function to apply security to HTTP functions
 */
export async function withSecurity<T>(
  request: HttpRequest,
  context: InvocationContext,
  options: Parameters<typeof securityMiddleware.applySecurityMiddleware>[2],
  handler: (user?: AuthenticatedUser) => Promise<HttpResponseInit>
): Promise<HttpResponseInit> {
  
  const securityResult = await securityMiddleware.applySecurityMiddleware(
    request, 
    context, 
    options
  )

  if (securityResult.error) {
    return {
      ...securityResult.error,
      headers: {
        ...securityResult.error.headers,
        ...securityMiddleware.getSecurityHeaders(request.headers.get('origin') || undefined)
      }
    }
  }

  try {
    const response = await handler(securityResult.user)
    
    // Add security headers to successful responses
    return {
      ...response,
      headers: {
        ...response.headers,
        ...securityMiddleware.getSecurityHeaders(request.headers.get('origin') || undefined)
      }
    }
  } catch (error) {
    context.error('Handler error:', error)
    
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
      headers: securityMiddleware.getSecurityHeaders(request.headers.get('origin') || undefined)
    }
  }
}

export type { AuthenticatedUser }