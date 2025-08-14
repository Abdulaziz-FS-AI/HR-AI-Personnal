import { InvocationContext } from '@azure/functions'
import { AuthenticatedUser } from './security-middleware'
import { getDbManager } from '../shared/enhanced-db-utils'
import { validateUUID, ValidationError } from '../shared/validation-utils'

interface ResourceOwnership {
  resourceType: 'session' | 'file' | 'role' | 'analysis'
  resourceId: string
  userId: string
  verified: boolean
  permissions: string[]
}

export class AuthorizationService {
  private ownershipCache = new Map<string, { ownership: ResourceOwnership; expires: number }>()
  private readonly cacheExpiry = 5 * 60 * 1000 // 5 minutes

  /**
   * Check if user owns or has access to a resource
   */
  async checkResourceAccess(
    user: AuthenticatedUser,
    resourceType: ResourceOwnership['resourceType'],
    resourceId: string,
    requiredPermission: 'read' | 'write' | 'delete' = 'read',
    context?: InvocationContext
  ): Promise<{ authorized: boolean; ownership?: ResourceOwnership; error?: string }> {
    
    try {
      validateUUID(resourceId, `${resourceType}Id`)
      
      const cacheKey = `${resourceType}:${resourceId}:${user.id}`
      const cached = this.ownershipCache.get(cacheKey)
      
      // Use cache if available and not expired
      if (cached && cached.expires > Date.now()) {
        const authorized = this.hasPermission(cached.ownership, requiredPermission, user)
        return { authorized, ownership: cached.ownership }
      }

      // Verify ownership from database
      const ownership = await this.verifyResourceOwnership(
        user,
        resourceType,
        resourceId,
        context
      )

      if (!ownership.verified) {
        context?.warn('Resource access denied', {
          userId: user.id,
          resourceType,
          resourceId,
          reason: 'ownership_not_verified'
        })
        return {
          authorized: false,
          error: 'Resource not found or access denied'
        }
      }

      // Cache the result
      this.ownershipCache.set(cacheKey, {
        ownership,
        expires: Date.now() + this.cacheExpiry
      })

      const authorized = this.hasPermission(ownership, requiredPermission, user)
      
      if (!authorized) {
        context?.warn('Insufficient permissions for resource', {
          userId: user.id,
          resourceType,
          resourceId,
          requiredPermission,
          userPermissions: ownership.permissions
        })
      }

      return { authorized, ownership }

    } catch (error) {
      context?.error('Authorization check failed', {
        userId: user.id,
        resourceType,
        resourceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      return {
        authorized: false,
        error: 'Authorization check failed'
      }
    }
  }

  /**
   * Verify resource ownership from database
   */
  private async verifyResourceOwnership(
    user: AuthenticatedUser,
    resourceType: ResourceOwnership['resourceType'],
    resourceId: string,
    context?: InvocationContext
  ): Promise<ResourceOwnership> {
    
    const dbManager = getDbManager()
    let query: string
    let params: Record<string, any>

    switch (resourceType) {
      case 'session':
        query = `
          SELECT 
            bs.userId,
            bs.status,
            COUNT(uf.id) as fileCount,
            'owner' as permission_level
          FROM batch_sessions bs
          LEFT JOIN uploaded_files uf ON bs.sessionId = uf.sessionId
          WHERE bs.sessionId = @resourceId
          GROUP BY bs.userId, bs.status
        `
        params = { resourceId }
        break

      case 'file':
        query = `
          SELECT 
            uf.userId,
            uf.processingStatus,
            uf.sessionId,
            'owner' as permission_level
          FROM uploaded_files uf
          WHERE uf.id = @resourceId
        `
        params = { resourceId }
        break

      case 'role':
        query = `
          SELECT 
            r.userId,
            COUNT(rs.skillName) as skillCount,
            COUNT(rq.questionText) as questionCount,
            'owner' as permission_level
          FROM roles r
          LEFT JOIN role_skills rs ON r.id = rs.roleId
          LEFT JOIN role_questions rq ON r.id = rq.roleId
          WHERE r.id = @resourceId
          GROUP BY r.userId
        `
        params = { resourceId }
        break

      case 'analysis':
        query = `
          SELECT 
            uf.userId,
            rar.overallScore,
            uf.sessionId,
            'owner' as permission_level
          FROM resume_analysis_results rar
          JOIN uploaded_files uf ON rar.fileId = uf.id
          WHERE rar.id = @resourceId
        `
        params = { resourceId }
        break

      default:
        throw new ValidationError(`Unsupported resource type: ${resourceType}`)
    }

    try {
      const results = await dbManager.executeQuery(query, params)
      
      if (!results.length) {
        return {
          resourceType,
          resourceId,
          userId: user.id,
          verified: false,
          permissions: []
        }
      }

      const result = results[0]
      const isOwner = result.userId === user.id
      const isAdmin = user.roles.includes('admin')
      const isShared = this.checkSharedAccess(user, resourceType, result)

      return {
        resourceType,
        resourceId,
        userId: result.userId,
        verified: isOwner || isAdmin || isShared,
        permissions: this.calculatePermissions(user, result, isOwner, isAdmin, isShared)
      }

    } catch (error) {
      context?.error('Database query failed during authorization', {
        resourceType,
        resourceId,
        query: query.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      return {
        resourceType,
        resourceId,
        userId: user.id,
        verified: false,
        permissions: []
      }
    }
  }

  /**
   * Check if user has required permission level
   */
  private hasPermission(
    ownership: ResourceOwnership,
    requiredPermission: 'read' | 'write' | 'delete',
    user: AuthenticatedUser
  ): boolean {
    if (!ownership.verified) return false
    
    // Admin has all permissions
    if (user.roles.includes('admin')) return true
    
    // Owner has all permissions
    if (ownership.userId === user.id) return true

    // Check specific permissions
    const permissionHierarchy = ['read', 'write', 'delete']
    const requiredLevel = permissionHierarchy.indexOf(requiredPermission)
    
    return ownership.permissions.some(permission => {
      const userLevel = permissionHierarchy.indexOf(permission)
      return userLevel >= requiredLevel
    })
  }

  /**
   * Check for shared access (future expansion for team features)
   */
  private checkSharedAccess(
    user: AuthenticatedUser,
    resourceType: ResourceOwnership['resourceType'],
    resourceData: any
  ): boolean {
    // Placeholder for future team/sharing features
    // Could check for:
    // - Team membership
    // - Shared sessions
    // - Department access
    return false
  }

  /**
   * Calculate user permissions for resource
   */
  private calculatePermissions(
    user: AuthenticatedUser,
    resourceData: any,
    isOwner: boolean,
    isAdmin: boolean,
    isShared: boolean
  ): string[] {
    const permissions: string[] = []

    if (isAdmin) {
      return ['read', 'write', 'delete', 'admin']
    }

    if (isOwner) {
      permissions.push('read', 'write', 'delete')
    }

    if (isShared) {
      permissions.push('read')
      // Additional shared permissions based on resource type and sharing level
    }

    return permissions
  }

  /**
   * Bulk authorization check for multiple resources
   */
  async checkBulkResourceAccess(
    user: AuthenticatedUser,
    resources: Array<{
      type: ResourceOwnership['resourceType']
      id: string
      permission?: 'read' | 'write' | 'delete'
    }>,
    context?: InvocationContext
  ): Promise<Map<string, boolean>> {
    
    const results = new Map<string, boolean>()
    
    // Process in batches to avoid overwhelming the database
    const batchSize = 10
    for (let i = 0; i < resources.length; i += batchSize) {
      const batch = resources.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async resource => {
        const key = `${resource.type}:${resource.id}`
        const authResult = await this.checkResourceAccess(
          user,
          resource.type,
          resource.id,
          resource.permission || 'read',
          context
        )
        
        return { key, authorized: authResult.authorized }
      })

      const batchResults = await Promise.all(batchPromises)
      batchResults.forEach(result => results.set(result.key, result.authorized))
    }

    return results
  }

  /**
   * Clear authorization cache for user (call on logout/role change)
   */
  clearUserCache(userId: string): void {
    const keysToDelete: string[] = []
    
    for (const [key] of this.ownershipCache) {
      if (key.includes(userId)) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => this.ownershipCache.delete(key))
  }

  /**
   * Clear expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    for (const [key, value] of this.ownershipCache) {
      if (value.expires <= now) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => this.ownershipCache.delete(key))
  }

  /**
   * Get user's accessible sessions with pagination
   */
  async getUserSessions(
    user: AuthenticatedUser,
    limit: number = 50,
    offset: number = 0,
    context?: InvocationContext
  ): Promise<{ sessions: any[]; total: number }> {
    
    const dbManager = getDbManager()
    
    try {
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM batch_sessions bs
        WHERE bs.userId = @userId
      `
      
      const countResult = await dbManager.executeQuery(countQuery, { userId: user.id })
      const total = countResult[0]?.total || 0

      // Get paginated sessions
      const sessionsQuery = `
        SELECT 
          bs.sessionId,
          bs.status,
          bs.totalFiles,
          bs.totalProcessed,
          bs.totalFailed,
          bs.createdAt,
          bs.completedAt,
          r.title as roleTitle
        FROM batch_sessions bs
        LEFT JOIN roles r ON bs.roleId = r.id
        WHERE bs.userId = @userId
        ORDER BY bs.createdAt DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `
      
      const sessions = await dbManager.executeQuery(sessionsQuery, {
        userId: user.id,
        limit,
        offset
      })

      return { sessions, total }

    } catch (error) {
      context?.error('Failed to get user sessions', {
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      return { sessions: [], total: 0 }
    }
  }
}

// Export singleton
export const authorizationService = new AuthorizationService()

/**
 * Middleware helper for resource authorization
 */
export async function requireResourceAccess(
  user: AuthenticatedUser,
  resourceType: ResourceOwnership['resourceType'],
  resourceId: string,
  permission: 'read' | 'write' | 'delete' = 'read',
  context?: InvocationContext
): Promise<{ authorized: true } | { authorized: false; error: string }> {
  
  const authResult = await authorizationService.checkResourceAccess(
    user,
    resourceType,
    resourceId,
    permission,
    context
  )

  if (!authResult.authorized) {
    return {
      authorized: false,
      error: authResult.error || 'Access denied'
    }
  }

  return { authorized: true }
}

export type { ResourceOwnership }