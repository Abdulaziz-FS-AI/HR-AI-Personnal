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
  
  let pool: sql.ConnectionPool | null = null
  try {
    pool = await getDbConnection()
    const result = await queryBuilder(pool, userId)
    return result
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  } finally {
    if (pool) {
      try {
        await pool.close()
      } catch (closeError) {
        console.error('Error closing database connection:', closeError)
      }
    }
  }
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

// ROLE SKILLS - User-scoped operations
export async function getUserRoleSkills(userId: string, roleId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    // First verify role ownership
    const ownership = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('roleId', sql.UniqueIdentifier, roleId)
      .query(`
        SELECT id FROM roles 
        WHERE id = @roleId AND user_id = @userId AND is_active = 1
      `)
    
    if (ownership.recordset.length === 0) {
      return []
    }
    
    // Get skills for the role
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, roleId)
      .input('userId', sql.UniqueIdentifier, uid)
      .query(`
        SELECT rs.* 
        FROM role_skills rs
        INNER JOIN roles r ON rs.role_id = r.id
        WHERE rs.role_id = @roleId AND r.user_id = @userId
        ORDER BY rs.weight DESC, rs.skill_name ASC
      `)
    
    return result.recordset
  })
}

export async function createUserRoleSkill(userId: string, skillData: {
  roleId: string
  skillName: string
  skillCategory?: string | null
  weight: number
  isRequired: boolean
}) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    // First verify role ownership
    const ownership = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('roleId', sql.UniqueIdentifier, skillData.roleId)
      .query(`
        SELECT id FROM roles 
        WHERE id = @roleId AND user_id = @userId AND is_active = 1
      `)
    
    if (ownership.recordset.length === 0) {
      throw new Error('Role not found or access denied')
    }
    
    // Create the skill
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, skillData.roleId)
      .input('skillName', sql.NVarChar, skillData.skillName)
      .input('skillCategory', sql.NVarChar, skillData.skillCategory || null)
      .input('weight', sql.Int, skillData.weight)
      .input('isRequired', sql.Bit, skillData.isRequired)
      .input('userId', sql.UniqueIdentifier, uid)
      .query(`
        INSERT INTO role_skills (role_id, skill_name, skill_category, weight, is_required)
        OUTPUT INSERTED.*
        VALUES (@roleId, @skillName, @skillCategory, @weight, @isRequired)
      `)
    
    return result.recordset[0]
  })
}

export async function deleteUserRoleSkill(userId: string, skillId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    // Delete skill only if user owns the role
    const result = await pool.request()
      .input('skillId', sql.UniqueIdentifier, skillId)
      .input('userId', sql.UniqueIdentifier, uid)
      .query(`
        DELETE rs
        FROM role_skills rs
        INNER JOIN roles r ON rs.role_id = r.id
        WHERE rs.id = @skillId AND r.user_id = @userId AND r.is_active = 1
      `)
    
    return result.rowsAffected[0] > 0
  })
}

// ROLE REQUIREMENTS - User-scoped operations
export async function getUserRoleRequirements(userId: string, roleId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    // First verify role ownership
    const ownership = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('roleId', sql.UniqueIdentifier, roleId)
      .query(`
        SELECT id FROM roles 
        WHERE id = @roleId AND user_id = @userId AND is_active = 1
      `)
    
    if (ownership.recordset.length === 0) {
      return []
    }
    
    // Get requirements for the role
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, roleId)
      .input('userId', sql.UniqueIdentifier, uid)
      .query(`
        SELECT rr.* 
        FROM role_requirements rr
        INNER JOIN roles r ON rr.role_id = r.id
        WHERE rr.role_id = @roleId AND r.user_id = @userId
        ORDER BY rr.category, rr.weight DESC
      `)
    
    return result.recordset
  })
}

export async function createUserRoleRequirement(userId: string, requirementData: {
  roleId: string
  requirementText: string
  weight: number
  isRequired: boolean
  category: 'education' | 'experience' | 'other'
}) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    // First verify role ownership
    const ownership = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('roleId', sql.UniqueIdentifier, requirementData.roleId)
      .query(`
        SELECT id FROM roles 
        WHERE id = @roleId AND user_id = @userId AND is_active = 1
      `)
    
    if (ownership.recordset.length === 0) {
      throw new Error('Role not found or access denied')
    }
    
    // Create the requirement
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, requirementData.roleId)
      .input('requirementText', sql.NVarChar, requirementData.requirementText)
      .input('weight', sql.Int, requirementData.weight)
      .input('isRequired', sql.Bit, requirementData.isRequired)
      .input('category', sql.NVarChar, requirementData.category)
      .input('userId', sql.UniqueIdentifier, uid)
      .query(`
        INSERT INTO role_requirements (role_id, requirement_text, weight, is_required, category)
        OUTPUT INSERTED.*
        VALUES (@roleId, @requirementText, @weight, @isRequired, @category)
      `)
    
    return result.recordset[0]
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

// ROLE SKILLS - User-scoped operations
export interface RoleSkill {
  id: string
  roleId: string
  skillName: string
  weight: number
  isRequired: boolean
  skillCategory: string | null
  createdAt: Date
}


// ROLE QUESTIONS - User-scoped operations
export interface RoleQuestion {
  id: string
  roleId: string
  questionText: string
  weight: number
  category: string | null
  isActive: boolean
  createdAt: Date
}

export async function getUserRoleQuestions(userId: string, roleId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    // First verify the role belongs to the user
    const roleCheck = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('roleId', sql.UniqueIdentifier, roleId)
      .query(`
        SELECT id FROM roles 
        WHERE id = @roleId AND user_id = @userId AND is_active = 1
      `)
    
    if (roleCheck.recordset.length === 0) {
      throw new Error('Role not found or access denied')
    }
    
    // Then get the questions
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, roleId)
      .input('userId', sql.UniqueIdentifier, uid)
      .query(`
        SELECT rq.id, rq.role_id as roleId, rq.question_text as questionText,
               rq.weight, rq.category, rq.is_active as isActive, rq.created_at as createdAt
        FROM role_questions rq
        INNER JOIN roles r ON rq.role_id = r.id
        WHERE rq.role_id = @roleId AND r.user_id = @userId AND r.is_active = 1 AND rq.is_active = 1
        ORDER BY rq.weight DESC, rq.created_at
      `)
    
    return result.recordset
  })
}

export async function createUserRoleQuestion(userId: string, questionData: Omit<RoleQuestion, 'id' | 'createdAt' | 'isActive'>) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    // First verify the role belongs to the user
    const roleCheck = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('roleId', sql.UniqueIdentifier, questionData.roleId)
      .query(`
        SELECT id FROM roles 
        WHERE id = @roleId AND user_id = @userId AND is_active = 1
      `)
    
    if (roleCheck.recordset.length === 0) {
      throw new Error('Role not found or access denied')
    }
    
    // Create the question
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, questionData.roleId)
      .input('questionText', sql.NText, questionData.questionText)
      .input('weight', sql.Int, questionData.weight)
      .input('category', sql.NVarChar, questionData.category)
      .query(`
        INSERT INTO role_questions (role_id, question_text, weight, category)
        OUTPUT INSERTED.id, INSERTED.role_id as roleId, INSERTED.question_text as questionText,
               INSERTED.weight, INSERTED.category, INSERTED.is_active as isActive,
               INSERTED.created_at as createdAt
        VALUES (@roleId, @questionText, @weight, @category)
      `)
    
    return result.recordset[0]
  })
}

export async function deleteUserRoleQuestion(userId: string, questionId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    // Verify the question belongs to a role owned by the user
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('questionId', sql.UniqueIdentifier, questionId)
      .query(`
        UPDATE rq 
        SET is_active = 0
        FROM role_questions rq
        INNER JOIN roles r ON rq.role_id = r.id
        WHERE rq.id = @questionId AND r.user_id = @userId AND r.is_active = 1
      `)
    
    return result.rowsAffected[0] > 0
  })
}

// ROLE REQUIREMENTS - User-scoped operations
export interface RoleRequirement {
  id: string
  roleId: string
  requirementText: string
  weight: number
  isRequired: boolean
  category: 'education' | 'experience' | 'other'
  createdAt: Date
}

export async function deleteUserRoleRequirement(userId: string, requirementId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    // Verify the requirement belongs to a role owned by the user
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('requirementId', sql.UniqueIdentifier, requirementId)
      .query(`
        DELETE rr FROM role_requirements rr
        INNER JOIN roles r ON rr.role_id = r.id
        WHERE rr.id = @requirementId AND r.user_id = @userId AND r.is_active = 1
      `)
    
    return result.rowsAffected[0] > 0
  })
}

// UPLOAD SESSIONS - User-scoped operations
export interface UploadSession {
  id: string
  userId: string
  roleId: string | null
  sessionToken: string
  totalFiles: number
  uploadedFiles: number
  processedFiles: number
  failedFiles: number
  status: 'active' | 'completed' | 'failed' | 'expired'
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
}

export async function getUserUploadSessionByToken(userId: string, sessionToken: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('sessionToken', sql.NVarChar, sessionToken)
      .query(`
        SELECT id, user_id as userId, role_id as roleId, session_token as sessionToken,
               total_files as totalFiles, uploaded_files as uploadedFiles,
               processed_files as processedFiles, failed_files as failedFiles,
               status, created_at as createdAt, updated_at as updatedAt, expires_at as expiresAt
        FROM upload_sessions 
        WHERE session_token = @sessionToken AND user_id = @userId
      `)
    
    return result.recordset[0] || null
  })
}

export async function updateUserUploadSession(userId: string, sessionId: string, updates: {
  uploadedFiles?: number
  processedFiles?: number
  failedFiles?: number
  status?: UploadSession['status']
}) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    // First verify session belongs to user
    const sessionCheck = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('sessionId', sql.UniqueIdentifier, sessionId)
      .query(`
        SELECT id FROM upload_sessions 
        WHERE id = @sessionId AND user_id = @userId
      `)
    
    if (sessionCheck.recordset.length === 0) {
      throw new Error('Upload session not found or access denied')
    }
    
    // Update session
    const updateFields = []
    const request = pool.request()
      .input('sessionId', sql.UniqueIdentifier, sessionId)
      .input('userId', sql.UniqueIdentifier, uid)
      .input('updatedAt', sql.DateTime2, new Date())
    
    if (updates.uploadedFiles !== undefined) {
      updateFields.push('uploaded_files = @uploadedFiles')
      request.input('uploadedFiles', sql.Int, updates.uploadedFiles)
    }
    
    if (updates.processedFiles !== undefined) {
      updateFields.push('processed_files = @processedFiles')
      request.input('processedFiles', sql.Int, updates.processedFiles)
    }
    
    if (updates.failedFiles !== undefined) {
      updateFields.push('failed_files = @failedFiles')
      request.input('failedFiles', sql.Int, updates.failedFiles)
    }
    
    if (updates.status) {
      updateFields.push('status = @status')
      request.input('status', sql.NVarChar, updates.status)
    }
    
    if (updateFields.length === 0) return false
    
    updateFields.push('updated_at = @updatedAt')
    
    const result = await request.query(`
      UPDATE upload_sessions 
      SET ${updateFields.join(', ')}
      WHERE id = @sessionId AND user_id = @userId
    `)
    
    return result.rowsAffected[0] > 0
  })
}

// FILES - User-scoped operations (extending existing getUserFile function)
export interface FileRecord {
  id: string
  userId: string
  roleId: string | null
  originalFilename: string
  blobFilename: string
  fileSize: number
  mimeType: string
  blobUrl: string
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'failed'
  processingStatus: 'not_started' | 'extracting' | 'analyzing' | 'completed' | 'failed'
  extractedText: string | null
  aiAnalysis: string | null
  aiScore: number | null
  aiDecision: 'accept' | 'maybe' | 'reject' | null
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

export async function getUserFileById(userId: string, fileId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('fileId', sql.UniqueIdentifier, fileId)
      .query(`
        SELECT id, user_id as userId, role_id as roleId, original_filename as originalFilename,
               blob_filename as blobFilename, file_size as fileSize, mime_type as mimeType,
               blob_url as blobUrl, upload_status as uploadStatus, processing_status as processingStatus,
               extracted_text as extractedText, ai_analysis as aiAnalysis, ai_score as aiScore,
               ai_decision as aiDecision, created_at as createdAt, updated_at as updatedAt,
               is_active as isActive
        FROM files 
        WHERE id = @fileId AND user_id = @userId AND is_active = 1
      `)
    
    return result.recordset[0] || null
  })
}

export async function updateUserFileStatus(userId: string, fileId: string, updates: {
  uploadStatus?: FileRecord['uploadStatus']
  processingStatus?: FileRecord['processingStatus']
  extractedText?: string
  aiAnalysis?: string
  aiScore?: number
  aiDecision?: FileRecord['aiDecision']
}) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    // First verify file belongs to user
    const fileCheck = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('fileId', sql.UniqueIdentifier, fileId)
      .query(`
        SELECT id FROM files 
        WHERE id = @fileId AND user_id = @userId AND is_active = 1
      `)
    
    if (fileCheck.recordset.length === 0) {
      throw new Error('File not found or access denied')
    }
    
    // Update file
    const updateFields = []
    const request = pool.request()
      .input('fileId', sql.UniqueIdentifier, fileId)
      .input('userId', sql.UniqueIdentifier, uid)
      .input('updatedAt', sql.DateTime2, new Date())
    
    if (updates.uploadStatus) {
      updateFields.push('upload_status = @uploadStatus')
      request.input('uploadStatus', sql.NVarChar, updates.uploadStatus)
    }
    
    if (updates.processingStatus) {
      updateFields.push('processing_status = @processingStatus')
      request.input('processingStatus', sql.NVarChar, updates.processingStatus)
    }
    
    if (updates.extractedText !== undefined) {
      updateFields.push('extracted_text = @extractedText')
      request.input('extractedText', sql.NText, updates.extractedText)
    }
    
    if (updates.aiAnalysis !== undefined) {
      updateFields.push('ai_analysis = @aiAnalysis')
      request.input('aiAnalysis', sql.NText, updates.aiAnalysis)
    }
    
    if (updates.aiScore !== undefined) {
      updateFields.push('ai_score = @aiScore')
      request.input('aiScore', sql.Decimal(5, 2), updates.aiScore)
    }
    
    if (updates.aiDecision !== undefined) {
      updateFields.push('ai_decision = @aiDecision')
      request.input('aiDecision', sql.NVarChar, updates.aiDecision)
    }
    
    if (updateFields.length === 0) return false
    
    updateFields.push('updated_at = @updatedAt')
    
    const result = await request.query(`
      UPDATE files 
      SET ${updateFields.join(', ')}
      WHERE id = @fileId AND user_id = @userId AND is_active = 1
    `)
    
    return result.rowsAffected[0] > 0
  })
}

// BATCH PROCESSING - User-scoped operations
export interface BatchProcessingSession {
  sessionId: string
  userId: string
  roleId: string
  totalFiles: number
  processedFiles: number
  failedFiles: number
  startedAt: Date
  completedAt?: Date
  status: 'pending' | 'processing' | 'completed' | 'failed'
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

// MISSING FUNCTIONS FOR COMPLETE API COVERAGE


// Upload Session functions
export async function getUserUploadSession(sessionId: string, userId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('sessionId', sql.UniqueIdentifier, sessionId)
      .query(`
        SELECT id, user_id as userId, role_id as roleId, session_token as sessionToken,
               total_files as totalFiles, uploaded_files as uploadedFiles,
               processed_files as processedFiles, failed_files as failedFiles,
               status, created_at as createdAt, updated_at as updatedAt, expires_at as expiresAt
        FROM upload_sessions 
        WHERE id = @sessionId AND user_id = @userId
      `)
    
    return result.recordset[0] || null
  })
}

export async function getUserSessionFiles(sessionId: string, userId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('sessionId', sql.UniqueIdentifier, sessionId)
      .query(`
        SELECT f.id, f.user_id as userId, f.role_id as roleId, 
               f.original_filename as originalFilename, f.blob_filename as blobFilename,
               f.file_size as fileSize, f.mime_type as mimeType, f.blob_url as blobUrl,
               f.upload_status as uploadStatus, f.processing_status as processingStatus,
               f.extracted_text as extractedText, f.ai_analysis as aiAnalysis,
               f.ai_score as aiScore, f.ai_decision as aiDecision,
               f.created_at as createdAt, f.updated_at as updatedAt
        FROM files f
        INNER JOIN upload_sessions us ON f.session_id = us.id
        WHERE us.id = @sessionId AND f.user_id = @userId AND f.is_active = 1
        ORDER BY f.created_at ASC
      `)
    
    return result.recordset
  })
}

// File operations - using existing functions with consistent parameter order
export async function updateUserFile(fileId: string, userId: string, updates: any) {
  return updateUserFileStatus(userId, fileId, updates)
}

// EVALUATIONS - User-scoped operations
export async function getUserEvaluations(userId: string, filters?: {
  roleId?: string
  status?: string
  limit?: number
  offset?: number
}) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const request = pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('limit', sql.Int, filters?.limit || 50)
      .input('offset', sql.Int, filters?.offset || 0)
    
    let whereConditions = ['es.user_id = @userId']
    
    if (filters?.roleId) {
      request.input('roleId', sql.UniqueIdentifier, filters.roleId)
      whereConditions.push('es.role_id = @roleId')
    }
    
    if (filters?.status) {
      request.input('status', sql.NVarChar, filters.status)
      whereConditions.push('es.status = @status')
    }
    
    const result = await request.query(`
      SELECT 
        es.id,
        es.name,
        es.role_id as roleId,
        r.title as roleTitle,
        es.status,
        es.total_files as totalFiles,
        es.processed_files as processedFiles,
        es.average_score as averageScore,
        es.top_candidates as topCandidates,
        es.created_at as createdAt,
        es.completed_at as completedAt
      FROM evaluation_sessions es
      LEFT JOIN roles r ON es.role_id = r.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY es.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `)
    
    return result.recordset
  })
}

export async function createUserEvaluation(userId: string, data: {
  name: string
  roleId: string
  roleTitle?: string
  files: Array<{ id: string; name: string; size: number }>
  status?: string
}) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    // Create evaluation session
    const sessionResult = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('roleId', sql.UniqueIdentifier, data.roleId)
      .input('name', sql.NVarChar, data.name)
      .input('totalFiles', sql.Int, data.files.length)
      .input('status', sql.NVarChar, data.status || 'created')
      .query(`
        INSERT INTO evaluation_sessions (
          user_id, role_id, name, total_files, processed_files, status
        )
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.role_id as roleId,
               INSERTED.status, INSERTED.total_files as totalFiles,
               INSERTED.created_at as createdAt
        VALUES (
          @userId, @roleId, @name, @totalFiles, 0, @status
        )
      `)
    
    const evaluationSession = sessionResult.recordset[0]
    
    // Insert files for this evaluation session
    for (const file of data.files) {
      await pool.request()
        .input('sessionId', sql.UniqueIdentifier, evaluationSession.id)
        .input('fileName', sql.NVarChar, file.name)
        .input('fileSize', sql.Int, file.size)
        .input('status', sql.NVarChar, 'created')
        .query(`
          INSERT INTO evaluation_files (
            session_id, file_name, file_size, status
          )
          VALUES (
            @sessionId, @fileName, @fileSize, @status
          )
        `)
    }
    
    return evaluationSession
  })
}

export async function getUserBatchSession(userId: string, sessionId: string) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('sessionId', sql.UniqueIdentifier, sessionId)
      .query(`
        SELECT 
          id,
          user_id as userId,
          status,
          total_files as totalFiles,
          processed_files as processedFiles,
          failed_files as failedFiles,
          created_at as createdAt,
          completed_at as completedAt
        FROM batch_sessions
        WHERE id = @sessionId AND user_id = @userId
      `)
    
    return result.recordset[0] || null
  })
}

export async function updateEvaluationStatus(userId: string, evaluationId: string, status: string, completedAt?: Date) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const request = pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .input('status', sql.NVarChar, status)
      .input('updatedAt', sql.DateTime2, new Date())
    
    let updateFields = 'status = @status, updated_at = @updatedAt'
    
    if (completedAt) {
      request.input('completedAt', sql.DateTime2, completedAt)
      updateFields += ', completed_at = @completedAt'
    }
    
    await request.query(`
      UPDATE evaluation_sessions 
      SET ${updateFields}
      WHERE id = @evaluationId AND user_id = @userId
    `)
    
    return true
  })
}

// EVALUATION SESSIONS - User-scoped operations
export interface EvaluationSession {
  id: string
  userId: string
  roleId: string
  name: string
  status: 'created' | 'processing' | 'completed' | 'failed' | 'cancelled'
  totalFiles: number
  processedFiles: number
  createdAt: Date
  updatedAt: Date
  roleTitle?: string
  completedAt?: Date | null
}

export async function getUserEvaluations(
  userId: string, 
  options?: { 
    roleId?: string
    status?: 'created' | 'processing' | 'completed' | 'failed' | 'cancelled'
    limit?: number
    offset?: number 
  }
) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const request = pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('limit', sql.Int, options?.limit || 50)
      .input('offset', sql.Int, options?.offset || 0)
    
    let whereConditions = ['es.user_id = @userId']
    
    if (options?.roleId) {
      request.input('roleId', sql.UniqueIdentifier, options.roleId)
      whereConditions.push('es.role_id = @roleId')
    }
    
    if (options?.status) {
      request.input('status', sql.NVarChar, options.status)
      whereConditions.push('es.status = @status')
    }
    
    const result = await request.query(`
      SELECT 
        es.id,
        es.user_id as userId,
        es.role_id as roleId,
        es.name,
        es.status,
        es.total_files as totalFiles,
        es.processed_files as processedFiles,
        es.created_at as createdAt,
        es.updated_at as updatedAt,
        es.completed_at as completedAt,
        r.title as roleTitle
      FROM evaluation_sessions es
      LEFT JOIN roles r ON es.role_id = r.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY es.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `)
    
    return result.recordset
  })
}

export async function createUserEvaluation(
  userId: string,
  evaluationData: {
    name: string
    roleId: string
    roleTitle: string
    files: Array<{ id: string; name: string; size: number }>
    status?: 'created' | 'processing' | 'completed' | 'failed' | 'cancelled'
  }
) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    
    try {
      // Create evaluation session
      const sessionRequest = new sql.Request(transaction)
      const sessionResult = await sessionRequest
        .input('userId', sql.UniqueIdentifier, uid)
        .input('roleId', sql.UniqueIdentifier, evaluationData.roleId)
        .input('name', sql.NVarChar, evaluationData.name)
        .input('status', sql.NVarChar, evaluationData.status || 'created')
        .input('totalFiles', sql.Int, evaluationData.files.length)
        .input('processedFiles', sql.Int, 0)
        .input('createdAt', sql.DateTime2, new Date())
        .input('updatedAt', sql.DateTime2, new Date())
        .query(`
          INSERT INTO evaluation_sessions (
            id, user_id, role_id, name, status, 
            total_files, processed_files, created_at, updated_at
          )
          OUTPUT INSERTED.*
          VALUES (
            NEWID(), @userId, @roleId, @name, @status,
            @totalFiles, @processedFiles, @createdAt, @updatedAt
          )
        `)
      
      const session = sessionResult.recordset[0]
      
      // Create evaluation_files entries for each uploaded file
      for (const file of evaluationData.files) {
        const fileRequest = new sql.Request(transaction)
        await fileRequest
          .input('evaluationId', sql.UniqueIdentifier, session.id)
          .input('fileId', sql.UniqueIdentifier, file.id)
          .input('userId', sql.UniqueIdentifier, uid)
          .input('filename', sql.NVarChar, file.name)
          .input('fileSize', sql.BigInt, file.size)
          .input('status', sql.NVarChar, 'created')
          .input('createdAt', sql.DateTime2, new Date())
          .input('updatedAt', sql.DateTime2, new Date())
          .query(`
            INSERT INTO evaluation_files (
              id, evaluation_id, file_id, user_id, filename, 
              file_size, status, created_at, updated_at
            )
            VALUES (
              NEWID(), @evaluationId, @fileId, @userId, @filename,
              @fileSize, @status, @createdAt, @updatedAt
            )
          `)
      }
      
      await transaction.commit()
      
      return {
        id: session.id,
        userId: session.user_id,
        roleId: session.role_id,
        name: session.name,
        status: session.status,
        totalFiles: session.total_files,
        processedFiles: session.processed_files,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        roleTitle: evaluationData.roleTitle
      }
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  })
}

export async function updateUserEvaluation(
  userId: string,
  evaluationId: string,
  updates: {
    status?: 'created' | 'processing' | 'completed' | 'failed' | 'cancelled'
    processedFiles?: number
    completedAt?: Date
  }
) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const updateFields = []
    const request = pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .input('userId', sql.UniqueIdentifier, uid)
      .input('updatedAt', sql.DateTime2, new Date())
    
    if (updates.status) {
      updateFields.push('status = @status')
      request.input('status', sql.NVarChar, updates.status)
    }
    
    if (updates.processedFiles !== undefined) {
      updateFields.push('processed_files = @processedFiles')
      request.input('processedFiles', sql.Int, updates.processedFiles)
    }
    
    if (updates.completedAt) {
      updateFields.push('completed_at = @completedAt')
      request.input('completedAt', sql.DateTime2, updates.completedAt)
    }
    
    updateFields.push('updated_at = @updatedAt')
    
    const result = await request.query(`
      UPDATE evaluation_sessions
      SET ${updateFields.join(', ')}
      WHERE id = @evaluationId AND user_id = @userId
    `)
    
    return result.rowsAffected[0] > 0
  })
}

export async function createEvaluationResult(userId: string, resultData: {
  evaluationId: string
  fileId: string
  overallScore: number
  skillsAnalysis: any
  recommendations: string[]
  redFlags: string[]
  aiDecision: string
  processingTime: number
  metadata?: any
}) {
  return executeUserScopedQuery(userId, async (pool, uid) => {
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, uid)
      .input('evaluationId', sql.UniqueIdentifier, resultData.evaluationId)
      .input('fileId', sql.UniqueIdentifier, resultData.fileId)
      .input('overallScore', sql.Float, resultData.overallScore)
      .input('skillsAnalysis', sql.NVarChar, JSON.stringify(resultData.skillsAnalysis))
      .input('recommendations', sql.NVarChar, JSON.stringify(resultData.recommendations))
      .input('redFlags', sql.NVarChar, JSON.stringify(resultData.redFlags))
      .input('aiDecision', sql.NVarChar, resultData.aiDecision)
      .input('processingTime', sql.Int, resultData.processingTime)
      .input('metadata', sql.NVarChar, resultData.metadata ? JSON.stringify(resultData.metadata) : null)
      .query(`
        INSERT INTO evaluation_results (
          evaluation_id, file_id, user_id, overall_score, skills_analysis,
          recommendations, red_flags, ai_decision, processing_time, metadata
        )
        OUTPUT INSERTED.id
        VALUES (
          @evaluationId, @fileId, @userId, @overallScore, @skillsAnalysis,
          @recommendations, @redFlags, @aiDecision, @processingTime, @metadata
        )
      `)
    
    return result.recordset[0]?.id || null
  })
}