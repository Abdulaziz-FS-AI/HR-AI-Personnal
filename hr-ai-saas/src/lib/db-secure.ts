/**
 * Secure database access layer with built-in user isolation
 * ALL database queries should go through these functions
 */

import sql from 'mssql'
import { getDbConnection } from './db'

/**
 * Base function to ensure all queries include user_id filtering
 */
async function executeUserScopedQuery<T>(
  userId: string,
  queryBuilder: (pool: sql.ConnectionPool, userId: string) => Promise<T>
): Promise<T> {
  if (!userId) {
    throw new Error('User ID is required for all database operations')
  }
  
  const pool = await getDbConnection()
  return queryBuilder(pool, userId)
}

// ROLES - User-scoped operations
export async function getUserRoles(userId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .query(`
        SELECT * FROM roles 
        WHERE user_id = @userId AND is_active = 1
        ORDER BY created_at DESC
      `)
    return result.recordset
  })
}

export async function getUserRole(userId: string, roleId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('roleId', sql.UniqueIdentifier, roleId)
      .query(`
        SELECT * FROM roles 
        WHERE id = @roleId AND user_id = @userId AND is_active = 1
      `)
    return result.recordset[0] || null
  })
}

export async function createUserRole(userId: string, roleData: any) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    // Ensure user_id is always set to the authenticated user
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('title', sql.NVarChar, roleData.title)
      .input('description', sql.NText, roleData.description)
      .input('responsibilities', sql.NText, roleData.responsibilities)
      .query(`
        INSERT INTO roles (user_id, title, description, responsibilities)
        OUTPUT INSERTED.*
        VALUES (@userId, @title, @description, @responsibilities)
      `)
    return result.recordset[0]
  })
}

export async function updateUserRole(userId: string, roleId: string, updates: any) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    // First verify ownership
    const ownership = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('roleId', sql.UniqueIdentifier, roleId)
      .query(`
        SELECT id FROM roles 
        WHERE id = @roleId AND user_id = @userId AND is_active = 1
      `)
    
    if (ownership.recordset.length === 0) {
      throw new Error('Role not found or access denied')
    }
    
    // Then update
    const updateFields = []
    const request = pool.request()
      .input('roleId', sql.UniqueIdentifier, roleId)
      .input('userId', sql.UniqueIdentifier, uid)
      .input('updatedAt', sql.DateTime2, new Date())
    
    if (updates.title) {
      updateFields.push('title = @title')
      request.input('title', sql.NVarChar, updates.title)
    }
    if (updates.description !== undefined) {
      updateFields.push('description = @description')
      request.input('description', sql.NText, updates.description)
    }
    
    updateFields.push('updated_at = @updatedAt')
    
    const result = await request.query(`
      UPDATE roles 
      SET ${updateFields.join(', ')}
      OUTPUT INSERTED.*
      WHERE id = @roleId AND user_id = @userId
    `)
    
    return result.recordset[0]
  })
}

export async function deleteUserRole(userId: string, roleId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('roleId', sql.UniqueIdentifier, roleId)
      .query(`
        UPDATE roles 
        SET is_active = 0, updated_at = GETUTCDATE()
        WHERE id = @roleId AND user_id = @userId AND is_active = 1
      `)
    return result.rowsAffected[0] > 0
  })
}

// FILES - User-scoped operations
export async function getUserFiles(userId: string, filters?: {
  status?: string
  roleId?: string
  limit?: number
}) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    let query = `
      SELECT * FROM files 
      WHERE user_id = @userId AND is_active = 1
    `
    
    const request = pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
    
    if (filters?.status) {
      query += ' AND processing_status = @status'
      request.input('status', sql.NVarChar, filters.status)
    }
    
    if (filters?.roleId) {
      query += ' AND role_id = @roleId'
      request.input('roleId', sql.UniqueIdentifier, filters.roleId)
    }
    
    query += ' ORDER BY created_at DESC'
    
    if (filters?.limit) {
      query = `SELECT TOP(@limit) * FROM (${query}) AS subquery`
      request.input('limit', sql.Int, filters.limit)
    }
    
    const result = await request.query(query)
    return result.recordset
  })
}

export async function getUserFile(userId: string, fileId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('fileId', sql.UniqueIdentifier, fileId)
      .query(`
        SELECT * FROM files 
        WHERE id = @fileId AND user_id = @userId AND is_active = 1
      `)
    
    if (result.recordset.length === 0) {
      throw new Error('File not found or access denied')
    }
    
    return result.recordset[0]
  })
}

// EVALUATIONS - User-scoped operations
export async function getUserEvaluations(userId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .query(`
        SELECT 
          es.*,
          r.title as role_title,
          (SELECT COUNT(*) FROM evaluation_files WHERE session_id = es.id) as file_count,
          (SELECT COUNT(*) FROM evaluation_results WHERE session_id = es.id) as result_count
        FROM evaluation_sessions es
        LEFT JOIN roles r ON es.role_id = r.id
        WHERE es.user_id = @userId
        ORDER BY es.created_at DESC
      `)
    return result.recordset
  })
}

export async function getUserEvaluation(userId: string, evaluationId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query(`
        SELECT * FROM evaluation_sessions 
        WHERE id = @evaluationId AND user_id = @userId
      `)
    
    if (result.recordset.length === 0) {
      throw new Error('Evaluation not found or access denied')
    }
    
    return result.recordset[0]
  })
}

// RESULTS - User-scoped operations
export async function getUserResults(userId: string, filters?: {
  roleId?: string
  sessionId?: string
  minScore?: number
}) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    let query = `
      SELECT 
        er.*,
        f.original_filename,
        r.title as role_title
      FROM evaluation_results er
      INNER JOIN files f ON er.file_id = f.id
      LEFT JOIN roles r ON er.role_id = r.id
      WHERE er.user_id = @userId
    `
    
    const request = pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
    
    if (filters?.roleId) {
      query += ' AND er.role_id = @roleId'
      request.input('roleId', sql.UniqueIdentifier, filters.roleId)
    }
    
    if (filters?.sessionId) {
      query += ' AND er.session_id = @sessionId'
      request.input('sessionId', sql.UniqueIdentifier, filters.sessionId)
    }
    
    if (filters?.minScore) {
      query += ' AND er.overall_score >= @minScore'
      request.input('minScore', sql.Decimal(5, 2), filters.minScore)
    }
    
    query += ' ORDER BY er.overall_score DESC, er.created_at DESC'
    
    const result = await request.query(query)
    return result.recordset
  })
}

// USAGE STATISTICS - User-scoped
export async function getUserUsageStats(userId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('thirtyDaysAgo', sql.DateTime2, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .query(`
        SELECT 
          (SELECT COUNT(*) FROM roles WHERE user_id = @userId AND is_active = 1) as total_roles,
          (SELECT COUNT(*) FROM files WHERE user_id = @userId AND is_active = 1) as total_files,
          (SELECT COUNT(*) FROM evaluation_sessions WHERE user_id = @userId) as total_evaluations,
          (SELECT COUNT(*) FROM evaluation_results WHERE user_id = @userId) as total_results,
          (SELECT SUM(file_size) / 1048576 FROM files WHERE user_id = @userId AND is_active = 1) as storage_used_mb,
          (SELECT COUNT(*) FROM evaluation_sessions WHERE user_id = @userId AND created_at > @thirtyDaysAgo) as evaluations_last_30_days,
          (SELECT credits_remaining FROM users WHERE id = @userId) as credits_remaining
      `)
    return result.recordset[0]
  })
}

// BULK DELETE - User-scoped with safety checks
export async function deleteUserData(userId: string, dataType: 'all' | 'files' | 'evaluations' | 'results') {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    
    try {
      const request = new sql.Request(transaction)
        .input('userId', sql.UniqueIdentifier, uid)
      
      if (dataType === 'all' || dataType === 'results') {
        await request.query(`
          DELETE FROM evaluation_results WHERE user_id = @userId
        `)
      }
      
      if (dataType === 'all' || dataType === 'evaluations') {
        await request.query(`
          DELETE FROM evaluation_files WHERE session_id IN (
            SELECT id FROM evaluation_sessions WHERE user_id = @userId
          )
        `)
        await request.query(`
          DELETE FROM evaluation_sessions WHERE user_id = @userId
        `)
      }
      
      if (dataType === 'all' || dataType === 'files') {
        await request.query(`
          UPDATE files SET is_active = 0 WHERE user_id = @userId
        `)
      }
      
      await transaction.commit()
      return { success: true, message: `User ${dataType} data deleted successfully` }
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  })
}