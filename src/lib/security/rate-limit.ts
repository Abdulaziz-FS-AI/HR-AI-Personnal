import { NextRequest } from 'next/server'
import sql from 'mssql'
import { getDbConnection } from '@/lib/db'

interface RateLimitConfig {
  windowMs: number  // Time window in milliseconds
  maxRequests: number  // Max requests per window
  keyPrefix?: string  // Prefix for the rate limit key
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  retryAfter?: number  // Seconds until reset
}

/**
 * Rate limiting service for API endpoints
 */
export class RateLimiter {
  private static rateLimitStore = new Map<string, { count: number; resetAt: Date }>()
  
  /**
   * Check rate limit for a user
   */
  static async checkRateLimit(
    userId: string,
    endpoint: string,
    config: RateLimitConfig = {
      windowMs: 60 * 1000,  // 1 minute default
      maxRequests: 60  // 60 requests per minute default
    }
  ): Promise<RateLimitResult> {
    const key = `${config.keyPrefix || 'rate'}:${userId}:${endpoint}`
    const now = Date.now()
    const resetAt = new Date(now + config.windowMs)
    
    // Get current rate limit data
    const current = this.rateLimitStore.get(key)
    
    if (!current || current.resetAt.getTime() <= now) {
      // New window or expired window
      this.rateLimitStore.set(key, {
        count: 1,
        resetAt
      })
      
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt
      }
    }
    
    // Check if limit exceeded
    if (current.count >= config.maxRequests) {
      const retryAfter = Math.ceil((current.resetAt.getTime() - now) / 1000)
      
      // Log rate limit exceeded event
      await this.logRateLimitExceeded(userId, endpoint, config.maxRequests)
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: current.resetAt,
        retryAfter
      }
    }
    
    // Increment counter
    current.count++
    this.rateLimitStore.set(key, current)
    
    return {
      allowed: true,
      remaining: config.maxRequests - current.count,
      resetAt: current.resetAt
    }
  }
  
  /**
   * Get rate limit configuration based on user tier
   */
  static getRateLimitConfig(
    userTier: string,
    endpoint: string
  ): RateLimitConfig {
    // Define rate limits per tier and endpoint
    const configs: Record<string, Record<string, RateLimitConfig>> = {
      basic: {
        default: { windowMs: 60000, maxRequests: 60 },  // 60/min
        upload: { windowMs: 60000, maxRequests: 10 },    // 10/min
        evaluate: { windowMs: 3600000, maxRequests: 5 }, // 5/hour
        export: { windowMs: 86400000, maxRequests: 5 }   // 5/day
      },
      premium: {
        default: { windowMs: 60000, maxRequests: 300 },   // 300/min
        upload: { windowMs: 60000, maxRequests: 50 },     // 50/min
        evaluate: { windowMs: 3600000, maxRequests: 20 }, // 20/hour
        export: { windowMs: 86400000, maxRequests: 50 }   // 50/day
      },
      enterprise: {
        default: { windowMs: 60000, maxRequests: 1000 },  // 1000/min
        upload: { windowMs: 60000, maxRequests: 200 },    // 200/min
        evaluate: { windowMs: 3600000, maxRequests: 100 },// 100/hour
        export: { windowMs: 86400000, maxRequests: 500 }  // 500/day
      }
    }
    
    const tierConfig = configs[userTier] || configs.basic
    return tierConfig[endpoint] || tierConfig.default
  }
  
  /**
   * Apply rate limiting to an API endpoint
   */
  static async applyRateLimit(
    request: NextRequest,
    userId: string,
    userTier: string,
    endpoint: string
  ): Promise<RateLimitResult> {
    const config = this.getRateLimitConfig(userTier, endpoint)
    return this.checkRateLimit(userId, endpoint, config)
  }
  
  /**
   * Log rate limit exceeded event
   */
  private static async logRateLimitExceeded(
    userId: string,
    endpoint: string,
    limit: number
  ): Promise<void> {
    try {
      const pool = await getDbConnection()
      await pool.request()
        .input('userId', sql.UniqueIdentifier, userId)
        .input('eventType', sql.NVarChar, 'rate_limit_exceeded')
        .input('severity', sql.NVarChar, 'warning')
        .input('description', sql.NText, `Rate limit exceeded for endpoint: ${endpoint} (limit: ${limit})`)
        .input('requestPath', sql.NVarChar, endpoint)
        .input('metadata', sql.NText, JSON.stringify({ endpoint, limit }))
        .query(`
          INSERT INTO security_events (user_id, event_type, severity, description, request_path, metadata)
          VALUES (@userId, @eventType, @severity, @description, @requestPath, @metadata)
        `)
    } catch (error) {
      console.error('Failed to log rate limit event:', error)
    }
  }
  
  /**
   * Clean up expired rate limit entries (call periodically)
   */
  static cleanupExpiredEntries(): void {
    const now = Date.now()
    for (const [key, value] of this.rateLimitStore.entries()) {
      if (value.resetAt.getTime() <= now) {
        this.rateLimitStore.delete(key)
      }
    }
  }
}

// Clean up expired entries every minute
setInterval(() => {
  RateLimiter.cleanupExpiredEntries()
}, 60000)

/**
 * Rate limiting middleware for Next.js API routes
 */
export async function withRateLimit(
  request: NextRequest,
  userId: string,
  userTier: string,
  endpoint: string
): Promise<{ allowed: boolean; response?: Response }> {
  const result = await RateLimiter.applyRateLimit(
    request,
    userId,
    userTier,
    endpoint
  )
  
  if (!result.allowed) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          success: false,
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(result.remaining + 1),
            'X-RateLimit-Remaining': String(result.remaining),
            'X-RateLimit-Reset': result.resetAt.toISOString(),
            'Retry-After': String(result.retryAfter)
          }
        }
      )
    }
  }
  
  return { allowed: true }
}