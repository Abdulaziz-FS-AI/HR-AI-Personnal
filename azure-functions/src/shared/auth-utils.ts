import jwt from 'jsonwebtoken'
import { HttpRequest } from '@azure/functions'

interface AuthenticatedUser {
  id: string
  email: string
  roles: string[]
}

/**
 * Validate JWT token from request headers
 */
export async function validateJWT(request: HttpRequest): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const jwtSecret = process.env.JWT_SECRET
    
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured')
    }

    const decoded = jwt.verify(token, jwtSecret) as any
    
    // Validate token structure
    if (!decoded.sub || !decoded.email) {
      return null
    }

    return {
      id: decoded.sub,
      email: decoded.email,
      roles: decoded.roles || []
    }
  } catch (error) {
    console.error('JWT validation failed:', error)
    return null
  }
}

/**
 * Check if user has required role
 */
export function hasRole(user: AuthenticatedUser, requiredRole: string): boolean {
  return user.roles.includes(requiredRole) || user.roles.includes('admin')
}

/**
 * Validate user owns resource
 */
export async function validateResourceOwnership(
  userId: string,
  resourceType: 'session' | 'file' | 'role',
  resourceId: string
): Promise<boolean> {
  // Implementation depends on resource type
  switch (resourceType) {
    case 'session':
      return await validateSessionOwnership(userId, resourceId)
    case 'file':
      return await validateFileOwnership(userId, resourceId)
    case 'role':
      return await validateRoleOwnership(userId, resourceId)
    default:
      return false
  }
}

async function validateSessionOwnership(userId: string, sessionId: string): Promise<boolean> {
  const { executeQuery } = await import('./db-utils')
  const result = await executeQuery(
    'SELECT COUNT(*) as count FROM batch_sessions WHERE sessionId = @sessionId AND userId = @userId',
    { sessionId, userId }
  )
  return result[0]?.count > 0
}

async function validateFileOwnership(userId: string, fileId: string): Promise<boolean> {
  const { executeQuery } = await import('./db-utils')
  const result = await executeQuery(
    'SELECT COUNT(*) as count FROM uploaded_files WHERE id = @fileId AND userId = @userId',
    { fileId, userId }
  )
  return result[0]?.count > 0
}

async function validateRoleOwnership(userId: string, roleId: string): Promise<boolean> {
  const { executeQuery } = await import('./db-utils')
  const result = await executeQuery(
    'SELECT COUNT(*) as count FROM roles WHERE id = @roleId AND userId = @userId',
    { roleId, userId }
  )
  return result[0]?.count > 0
}