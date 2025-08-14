import { getDbConnection } from './db-config'
import sql from 'mssql'

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

export interface AnalysisResult {
  id?: string
  fileId: string
  sessionId: string
  roleId: string
  userId: string
  overallScore: number
  skillsAnalysis: any // JSON field
  questionsAnalysis: any // JSON field
  summary: string
  recommendations: string[] // JSON field
  redFlags: string[] // JSON field
  totalTokensUsed: number
  createdAt?: Date
}

/**
 * Create batch processing session in database
 */
export async function createBatchSession(session: BatchProcessingSession): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    await pool.request()
      .input('sessionId', sql.NVarChar, session.sessionId)
      .input('userId', sql.UniqueIdentifier, session.userId)
      .input('roleId', sql.UniqueIdentifier, session.roleId)
      .input('totalFiles', sql.Int, session.totalFiles)
      .input('processedFiles', sql.Int, session.processedFiles)
      .input('failedFiles', sql.Int, session.failedFiles)
      .input('startedAt', sql.DateTime2, session.startedAt)
      .input('status', sql.NVarChar, session.status)
      .query(`
        INSERT INTO batch_sessions (session_id, user_id, role_id, total_files, processed_files, failed_files, started_at, status)
        VALUES (@sessionId, @userId, @roleId, @totalFiles, @processedFiles, @failedFiles, @startedAt, @status)
      `)
    
    return true
  } catch (error) {
    console.error('Error creating batch session:', error)
    return false
  }
}

/**
 * Update batch processing session
 */
export async function updateBatchSession(
  sessionId: string, 
  updates: Partial<BatchProcessingSession>
): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    
    // Build dynamic update query
    const updateFields: string[] = []
    const request = pool.request().input('sessionId', sql.NVarChar, sessionId)
    
    if (updates.processedFiles !== undefined) {
      updateFields.push('processed_files = @processedFiles')
      request.input('processedFiles', sql.Int, updates.processedFiles)
    }
    
    if (updates.failedFiles !== undefined) {
      updateFields.push('failed_files = @failedFiles')
      request.input('failedFiles', sql.Int, updates.failedFiles)
    }
    
    if (updates.status !== undefined) {
      updateFields.push('status = @status')
      request.input('status', sql.NVarChar, updates.status)
    }
    
    if (updates.completedAt !== undefined) {
      updateFields.push('completed_at = @completedAt')
      request.input('completedAt', sql.DateTime2, updates.completedAt)
    }
    
    if (updateFields.length === 0) {
      return true // Nothing to update
    }
    
    updateFields.push('updated_at = GETUTCDATE()')
    
    await request.query(`
      UPDATE batch_sessions 
      SET ${updateFields.join(', ')}
      WHERE session_id = @sessionId
    `)
    
    return true
  } catch (error) {
    console.error('Error updating batch session:', error)
    return false
  }
}

/**
 * Get batch processing session by ID
 */
export async function getBatchSession(sessionId: string): Promise<BatchProcessingSession | null> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('sessionId', sql.NVarChar, sessionId)
      .query(`
        SELECT session_id as sessionId, user_id as userId, role_id as roleId,
               total_files as totalFiles, processed_files as processedFiles,
               failed_files as failedFiles, started_at as startedAt,
               completed_at as completedAt, status
        FROM batch_sessions 
        WHERE session_id = @sessionId
      `)
    
    return result.recordset[0] || null
  } catch (error) {
    console.error('Error getting batch session:', error)
    return null
  }
}

/**
 * Store analysis result in database
 */
export async function storeAnalysisResult(result: AnalysisResult): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    await pool.request()
      .input('fileId', sql.UniqueIdentifier, result.fileId)
      .input('sessionId', sql.NVarChar, result.sessionId)
      .input('roleId', sql.UniqueIdentifier, result.roleId)
      .input('userId', sql.UniqueIdentifier, result.userId)
      .input('overallScore', sql.Int, result.overallScore)
      .input('skillsAnalysis', sql.NText, JSON.stringify(result.skillsAnalysis))
      .input('questionsAnalysis', sql.NText, JSON.stringify(result.questionsAnalysis))
      .input('summary', sql.NText, result.summary)
      .input('recommendations', sql.NText, JSON.stringify(result.recommendations))
      .input('redFlags', sql.NText, JSON.stringify(result.redFlags))
      .input('totalTokensUsed', sql.Int, result.totalTokensUsed)
      .query(`
        INSERT INTO resume_analysis_results 
        (file_id, session_id, role_id, user_id, overall_score, skills_analysis, 
         questions_analysis, summary, recommendations, red_flags, total_tokens_used)
        VALUES 
        (@fileId, @sessionId, @roleId, @userId, @overallScore, @skillsAnalysis,
         @questionsAnalysis, @summary, @recommendations, @redFlags, @totalTokensUsed)
      `)
    
    return true
  } catch (error) {
    console.error('Error storing analysis result:', error)
    return false
  }
}

/**
 * Get analysis results by session ID
 */
export async function getAnalysisResultsBySession(sessionId: string): Promise<AnalysisResult[]> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('sessionId', sql.NVarChar, sessionId)
      .query(`
        SELECT id, file_id as fileId, session_id as sessionId, role_id as roleId,
               user_id as userId, overall_score as overallScore, skills_analysis as skillsAnalysis,
               questions_analysis as questionsAnalysis, summary, recommendations, 
               red_flags as redFlags, total_tokens_used as totalTokensUsed, created_at as createdAt
        FROM resume_analysis_results 
        WHERE session_id = @sessionId
        ORDER BY created_at ASC
      `)
    
    return result.recordset.map(row => ({
      ...row,
      skillsAnalysis: JSON.parse(row.skillsAnalysis || '[]'),
      questionsAnalysis: JSON.parse(row.questionsAnalysis || '[]'),
      recommendations: JSON.parse(row.recommendations || '[]'),
      redFlags: JSON.parse(row.redFlags || '[]')
    }))
  } catch (error) {
    console.error('Error getting analysis results:', error)
    return []
  }
}

/**
 * Deploy database schema for batch processing
 */
export async function deployBatchSchema(): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    
    // Create batch_sessions table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='batch_sessions' AND xtype='U')
      CREATE TABLE batch_sessions (
        id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        session_id NVARCHAR(255) NOT NULL UNIQUE,
        user_id UNIQUEIDENTIFIER NOT NULL,
        role_id UNIQUEIDENTIFIER NOT NULL,
        total_files INT NOT NULL DEFAULT 0,
        processed_files INT NOT NULL DEFAULT 0,
        failed_files INT NOT NULL DEFAULT 0,
        started_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        completed_at DATETIME2 NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        INDEX IX_batch_sessions_user_id (user_id),
        INDEX IX_batch_sessions_session_id (session_id),
        INDEX IX_batch_sessions_status (status)
      )
    `)
    
    // Create resume_analysis_results table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='resume_analysis_results' AND xtype='U')
      CREATE TABLE resume_analysis_results (
        id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        file_id UNIQUEIDENTIFIER NOT NULL,
        session_id NVARCHAR(255) NOT NULL,
        role_id UNIQUEIDENTIFIER NOT NULL,
        user_id UNIQUEIDENTIFIER NOT NULL,
        overall_score INT NOT NULL DEFAULT 0,
        skills_analysis NTEXT NULL,
        questions_analysis NTEXT NULL,
        summary NTEXT NULL,
        recommendations NTEXT NULL,
        red_flags NTEXT NULL,
        total_tokens_used INT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        INDEX IX_analysis_results_file_id (file_id),
        INDEX IX_analysis_results_session_id (session_id),
        INDEX IX_analysis_results_user_id (user_id),
        INDEX IX_analysis_results_role_id (role_id)
      )
    `)
    
    console.log('✅ Batch processing database schema deployed successfully')
    return true
  } catch (error) {
    console.error('❌ Error deploying batch schema:', error)
    return false
  }
}