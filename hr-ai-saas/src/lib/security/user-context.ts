import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import sql from 'mssql'
import { getDbConnection } from '@/lib/db'

export interface UserContext {
  userId: string
  email: string
  subscriptionTier: string
  creditsRemaining: number
  isActive: boolean
}

/**
 * Validates user context and returns secure user data
 * This should be used in EVERY API route
 */
export async function requireUserContext(
  request?: NextRequest
): Promise<UserContext> {
  const session = await auth()
  
  if (!session?.user?.id) {
    throw new Error('Authentication required')
  }

  // Validate user is still active in database
  const pool = await getDbConnection()
  const result = await pool.request()
    .input('userId', sql.UniqueIdentifier, session.user.id)
    .query(`
      SELECT 
        id,
        email,
        subscription_tier as subscriptionTier,
        credits_remaining as creditsRemaining,
        is_active as isActive
      FROM users 
      WHERE id = @userId AND is_active = 1
    `)
  
  const user = result.recordset[0]
  
  if (!user) {
    throw new Error('User account not found or inactive')
  }

  return {
    userId: user.id,
    email: user.email,
    subscriptionTier: user.subscriptionTier,
    creditsRemaining: user.creditsRemaining,
    isActive: user.isActive
  }
}

/**
 * Validates that a resource belongs to the user
 * Prevents cross-user data access
 */
export async function validateResourceOwnership(
  resourceId: string,
  userId: string,
  resourceType: 'role' | 'file' | 'evaluation' | 'result'
): Promise<boolean> {
  const pool = await getDbConnection()
  
  let query = ''
  switch (resourceType) {
    case 'role':
      query = 'SELECT id FROM roles WHERE id = @resourceId AND user_id = @userId AND is_active = 1'
      break
    case 'file':
      query = 'SELECT id FROM files WHERE id = @resourceId AND user_id = @userId AND is_active = 1'
      break
    case 'evaluation':
      query = 'SELECT id FROM evaluation_sessions WHERE id = @resourceId AND user_id = @userId'
      break
    case 'result':
      query = 'SELECT id FROM evaluation_results WHERE id = @resourceId AND user_id = @userId'
      break
    default:
      throw new Error(`Unknown resource type: ${resourceType}`)
  }
  
  const result = await pool.request()
    .input('resourceId', sql.UniqueIdentifier, resourceId)
    .input('userId', sql.UniqueIdentifier, userId)
    .query(query)
  
  return result.recordset.length > 0
}

/**
 * Log data access for security auditing
 */
export async function logDataAccess(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const pool = await getDbConnection()
    await pool.request()
      .input('userId', sql.UniqueIdentifier, userId)
      .input('action', sql.NVarChar, action)
      .input('resourceType', sql.NVarChar, resourceType)
      .input('resourceId', sql.UniqueIdentifier, resourceId)
      .input('metadata', sql.NVarChar, JSON.stringify(metadata || {}))
      .input('ipAddress', sql.NVarChar, metadata?.ipAddress || 'unknown')
      .query(`
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address)
        VALUES (@userId, @action, @resourceType, @resourceId, @metadata, @ipAddress)
      `)
  } catch (error) {
    // Don't fail the request if logging fails, but log the error
    console.error('Failed to log data access:', error)
  }
}

/**
 * Check if user has exceeded their limits
 */
export async function checkUserQuota(
  userId: string,
  quotaType: 'files' | 'evaluations' | 'storage'
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const pool = await getDbConnection()
  
  // Get user's subscription tier
  const userResult = await pool.request()
    .input('userId', sql.UniqueIdentifier, userId)
    .query(`
      SELECT subscription_tier FROM users WHERE id = @userId
    `)
  
  const tier = userResult.recordset[0]?.subscription_tier || 'basic'
  
  // Define limits per tier (prepare for future billing)
  const limits = {
    basic: { files: 100, evaluations: 10, storage: 1024 }, // 1GB
    premium: { files: 1000, evaluations: 100, storage: 10240 }, // 10GB
    enterprise: { files: 10000, evaluations: 1000, storage: 102400 } // 100GB
  }
  
  const userLimits = limits[tier as keyof typeof limits] || limits.basic
  
  let current = 0
  switch (quotaType) {
    case 'files':
      const filesResult = await pool.request()
        .input('userId', sql.UniqueIdentifier, userId)
        .query(`
          SELECT COUNT(*) as count 
          FROM files 
          WHERE user_id = @userId AND is_active = 1
        `)
      current = filesResult.recordset[0].count
      break
      
    case 'evaluations':
      const evalsResult = await pool.request()
        .input('userId', sql.UniqueIdentifier, userId)
        .input('startDate', sql.DateTime2, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
        .query(`
          SELECT COUNT(*) as count 
          FROM evaluation_sessions 
          WHERE user_id = @userId AND created_at > @startDate
        `)
      current = evalsResult.recordset[0].count
      break
      
    case 'storage':
      const storageResult = await pool.request()
        .input('userId', sql.UniqueIdentifier, userId)
        .query(`
          SELECT SUM(file_size) / 1048576 as totalMB 
          FROM files 
          WHERE user_id = @userId AND is_active = 1
        `)
      current = Math.round(storageResult.recordset[0].totalMB || 0)
      break
  }
  
  return {
    allowed: current < userLimits[quotaType],
    current,
    limit: userLimits[quotaType]
  }
}