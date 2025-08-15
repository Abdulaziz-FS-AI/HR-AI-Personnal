import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

export interface UserContext {
  userId: string
  email: string
  isTestUser: boolean
}

/**
 * Get user context from authentication or fallback to test user in development
 */
export async function resolveUserContext(request: NextRequest): Promise<UserContext> {
  try {
    // Try to get real user session first
    const session = await auth()
    
    if (session?.user?.id) {
      return {
        userId: session.user.id,
        email: session.user.email || '',
        isTestUser: false
      }
    }
    
    // Development fallback only
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Using test user in development mode')
      return {
        userId: '5A5D9AC4-48BB-4117-89F2-5B1D8FC383B8',
        email: 'test@example.com',
        isTestUser: true
      }
    }
    
    // Production requires real auth
    throw new Error('Authentication required')
    
  } catch (error) {
    // Last resort: check for API key in headers
    const apiKey = request.headers.get('x-api-key')
    if (apiKey && process.env.API_KEY && apiKey === process.env.API_KEY) {
      return {
        userId: 'API_USER',
        email: 'api@system.com',
        isTestUser: false
      }
    }
    
    throw new Error('Failed to resolve user context: Authentication required')
  }
}

/**
 * Simplified version for test endpoints that need user context
 */
export async function getTestUserContext(): Promise<UserContext> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Test user context only available in development')
  }
  
  return {
    userId: '5A5D9AC4-48BB-4117-89F2-5B1D8FC383B8',
    email: 'test@example.com',
    isTestUser: true
  }
}