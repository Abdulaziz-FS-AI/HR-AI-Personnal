import sql from 'mssql'
import { getDbConnection } from './db'

export interface EvaluationSession {
  id: string
  userId: string
  roleId: string
  name: string
  description: string | null
  status: 'draft' | 'ready' | 'processing' | 'completed' | 'failed'
  totalFiles: number
  processedFiles: number
  failedFiles: number
  averageScore: number | null
  highestScore: number | null
  lowestScore: number | null
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
}

export interface EvaluationFile {
  id: string
  evaluationId: string
  fileName: string
  blobName: string
  fileSize: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  extractedText: string | null
  candidateInfo: any | null
  overallScore: number | null
  recommendation: string | null
  createdAt: Date
  processedAt: Date | null
}

export interface EvaluationResult {
  id: string
  evaluationId: string
  fileId: string
  scores: any
  skillsAnalysis: any
  questionsAnalysis: any
  summary: string
  strengths: string[]
  weaknesses: string[]
  redFlags: string[]
  recommendation: string
  suggestedInterviewQuestions: string[]
  createdAt: Date
}

// Evaluation Session Operations
export async function createEvaluationSession(data: {
  userId: string
  roleId: string
  name: string
  description?: string
}): Promise<EvaluationSession | null> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, data.userId)
      .input('roleId', sql.UniqueIdentifier, data.roleId)
      .input('name', sql.NVarChar, data.name)
      .input('description', sql.NText, data.description || null)
      .query(`
        INSERT INTO evaluation_sessions (
          user_id, role_id, name, description, status, 
          total_files, processed_files, failed_files
        )
        OUTPUT INSERTED.*
        VALUES (
          @userId, @roleId, @name, @description, 'draft',
          0, 0, 0
        )
      `)
    
    if (result.recordset.length > 0) {
      const row = result.recordset[0]
      return {
        id: row.id,
        userId: row.user_id,
        roleId: row.role_id,
        name: row.name,
        description: row.description,
        status: row.status,
        totalFiles: row.total_files,
        processedFiles: row.processed_files,
        failedFiles: row.failed_files,
        averageScore: row.average_score,
        highestScore: row.highest_score,
        lowestScore: row.lowest_score,
        createdAt: row.created_at,
        startedAt: row.started_at,
        completedAt: row.completed_at
      }
    }
    return null
  } catch (error) {
    console.error('Error creating evaluation session:', error)
    return null
  }
}

export async function getEvaluationSession(sessionId: string, userId: string): Promise<EvaluationSession | null> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('sessionId', sql.UniqueIdentifier, sessionId)
      .input('userId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT 
          id, user_id, role_id, name, description, status,
          total_files, processed_files, failed_files,
          average_score, highest_score, lowest_score,
          created_at, started_at, completed_at
        FROM evaluation_sessions
        WHERE id = @sessionId AND user_id = @userId
      `)
    
    if (result.recordset.length > 0) {
      const row = result.recordset[0]
      return {
        id: row.id,
        userId: row.user_id,
        roleId: row.role_id,
        name: row.name,
        description: row.description,
        status: row.status,
        totalFiles: row.total_files,
        processedFiles: row.processed_files,
        failedFiles: row.failed_files,
        averageScore: row.average_score,
        highestScore: row.highest_score,
        lowestScore: row.lowest_score,
        createdAt: row.created_at,
        startedAt: row.started_at,
        completedAt: row.completed_at
      }
    }
    return null
  } catch (error) {
    console.error('Error getting evaluation session:', error)
    return null
  }
}

export async function getUserEvaluationSessions(userId: string): Promise<EvaluationSession[]> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT 
          es.id, es.user_id, es.role_id, es.name, es.description, es.status,
          es.total_files, es.processed_files, es.failed_files,
          es.average_score, es.highest_score, es.lowest_score,
          es.created_at, es.started_at, es.completed_at,
          r.title as role_title
        FROM evaluation_sessions es
        INNER JOIN roles r ON es.role_id = r.id
        WHERE es.user_id = @userId
        ORDER BY es.created_at DESC
      `)
    
    return result.recordset.map(row => ({
      id: row.id,
      userId: row.user_id,
      roleId: row.role_id,
      name: row.name,
      description: row.description,
      status: row.status,
      totalFiles: row.total_files,
      processedFiles: row.processed_files,
      failedFiles: row.failed_files,
      averageScore: row.average_score,
      highestScore: row.highest_score,
      lowestScore: row.lowest_score,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at
    }))
  } catch (error) {
    console.error('Error getting user evaluation sessions:', error)
    return []
  }
}

export async function updateEvaluationSession(
  sessionId: string,
  updates: Partial<EvaluationSession>
): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    const request = pool.request()
      .input('sessionId', sql.UniqueIdentifier, sessionId)
    
    const updateFields = []
    
    if (updates.status) {
      updateFields.push('status = @status')
      request.input('status', sql.NVarChar, updates.status)
    }
    if (updates.totalFiles !== undefined) {
      updateFields.push('total_files = @totalFiles')
      request.input('totalFiles', sql.Int, updates.totalFiles)
    }
    if (updates.processedFiles !== undefined) {
      updateFields.push('processed_files = @processedFiles')
      request.input('processedFiles', sql.Int, updates.processedFiles)
    }
    if (updates.failedFiles !== undefined) {
      updateFields.push('failed_files = @failedFiles')
      request.input('failedFiles', sql.Int, updates.failedFiles)
    }
    if (updates.averageScore !== undefined) {
      updateFields.push('average_score = @averageScore')
      request.input('averageScore', sql.Float, updates.averageScore)
    }
    if (updates.highestScore !== undefined) {
      updateFields.push('highest_score = @highestScore')
      request.input('highestScore', sql.Float, updates.highestScore)
    }
    if (updates.lowestScore !== undefined) {
      updateFields.push('lowest_score = @lowestScore')
      request.input('lowestScore', sql.Float, updates.lowestScore)
    }
    if (updates.startedAt !== undefined) {
      updateFields.push('started_at = @startedAt')
      request.input('startedAt', sql.DateTime2, updates.startedAt)
    }
    if (updates.completedAt !== undefined) {
      updateFields.push('completed_at = @completedAt')
      request.input('completedAt', sql.DateTime2, updates.completedAt)
    }
    
    if (updateFields.length === 0) return true
    
    const result = await request.query(`
      UPDATE evaluation_sessions
      SET ${updateFields.join(', ')}
      WHERE id = @sessionId
    `)
    
    return result.rowsAffected[0] > 0
  } catch (error) {
    console.error('Error updating evaluation session:', error)
    return false
  }
}

// Evaluation File Operations
export async function addFilesToEvaluation(
  evaluationId: string,
  files: Array<{
    fileName: string
    blobName: string
    fileSize: number
  }>
): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    
    try {
      // Insert all files
      for (const file of files) {
        await transaction.request()
          .input('evaluationId', sql.UniqueIdentifier, evaluationId)
          .input('fileName', sql.NVarChar, file.fileName)
          .input('blobName', sql.NVarChar, file.blobName)
          .input('fileSize', sql.BigInt, file.fileSize)
          .query(`
            INSERT INTO evaluation_files (
              evaluation_id, file_name, blob_name, file_size, status
            )
            VALUES (
              @evaluationId, @fileName, @blobName, @fileSize, 'pending'
            )
          `)
      }
      
      // Update total files count
      await transaction.request()
        .input('evaluationId', sql.UniqueIdentifier, evaluationId)
        .input('fileCount', sql.Int, files.length)
        .query(`
          UPDATE evaluation_sessions
          SET total_files = total_files + @fileCount
          WHERE id = @evaluationId
        `)
      
      await transaction.commit()
      return true
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    console.error('Error adding files to evaluation:', error)
    return false
  }
}

export async function getEvaluationFiles(evaluationId: string): Promise<EvaluationFile[]> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query(`
        SELECT 
          id, evaluation_id, file_name, blob_name, file_size,
          status, extracted_text, candidate_info,
          overall_score, recommendation,
          created_at, processed_at
        FROM evaluation_files
        WHERE evaluation_id = @evaluationId
        ORDER BY created_at DESC
      `)
    
    return result.recordset.map(row => ({
      id: row.id,
      evaluationId: row.evaluation_id,
      fileName: row.file_name,
      blobName: row.blob_name,
      fileSize: row.file_size,
      status: row.status,
      extractedText: row.extracted_text,
      candidateInfo: row.candidate_info,
      overallScore: row.overall_score,
      recommendation: row.recommendation,
      createdAt: row.created_at,
      processedAt: row.processed_at
    }))
  } catch (error) {
    console.error('Error getting evaluation files:', error)
    return []
  }
}

export async function updateEvaluationFile(
  fileId: string,
  updates: Partial<EvaluationFile>
): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    const request = pool.request()
      .input('fileId', sql.UniqueIdentifier, fileId)
    
    const updateFields = []
    
    if (updates.status) {
      updateFields.push('status = @status')
      request.input('status', sql.NVarChar, updates.status)
    }
    if (updates.extractedText !== undefined) {
      updateFields.push('extracted_text = @extractedText')
      request.input('extractedText', sql.NText, updates.extractedText)
    }
    if (updates.candidateInfo !== undefined) {
      updateFields.push('candidate_info = @candidateInfo')
      request.input('candidateInfo', sql.NVarChar, JSON.stringify(updates.candidateInfo))
    }
    if (updates.overallScore !== undefined) {
      updateFields.push('overall_score = @overallScore')
      request.input('overallScore', sql.Float, updates.overallScore)
    }
    if (updates.recommendation !== undefined) {
      updateFields.push('recommendation = @recommendation')
      request.input('recommendation', sql.NText, updates.recommendation)
    }
    if (updates.processedAt !== undefined) {
      updateFields.push('processed_at = @processedAt')
      request.input('processedAt', sql.DateTime2, updates.processedAt)
    }
    
    if (updateFields.length === 0) return true
    
    const result = await request.query(`
      UPDATE evaluation_files
      SET ${updateFields.join(', ')}
      WHERE id = @fileId
    `)
    
    return result.rowsAffected[0] > 0
  } catch (error) {
    console.error('Error updating evaluation file:', error)
    return false
  }
}

// Evaluation Result Operations
export async function saveEvaluationResult(data: {
  evaluationId: string
  fileId: string
  scores: any
  skillsAnalysis: any
  questionsAnalysis: any
  summary: string
  strengths: string[]
  weaknesses: string[]
  redFlags: string[]
  recommendation: string
  suggestedInterviewQuestions: string[]
}): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, data.evaluationId)
      .input('fileId', sql.UniqueIdentifier, data.fileId)
      .input('scores', sql.NVarChar, JSON.stringify(data.scores))
      .input('skillsAnalysis', sql.NVarChar, JSON.stringify(data.skillsAnalysis))
      .input('questionsAnalysis', sql.NVarChar, JSON.stringify(data.questionsAnalysis))
      .input('summary', sql.NText, data.summary)
      .input('strengths', sql.NVarChar, JSON.stringify(data.strengths))
      .input('weaknesses', sql.NVarChar, JSON.stringify(data.weaknesses))
      .input('redFlags', sql.NVarChar, JSON.stringify(data.redFlags))
      .input('recommendation', sql.NText, data.recommendation)
      .input('suggestedInterviewQuestions', sql.NVarChar, JSON.stringify(data.suggestedInterviewQuestions))
      .query(`
        INSERT INTO evaluation_results (
          evaluation_id, file_id, scores, skills_analysis, questions_analysis,
          summary, strengths, weaknesses, red_flags,
          recommendation, suggested_interview_questions
        )
        VALUES (
          @evaluationId, @fileId, @scores, @skillsAnalysis, @questionsAnalysis,
          @summary, @strengths, @weaknesses, @redFlags,
          @recommendation, @suggestedInterviewQuestions
        )
      `)
    
    return result.rowsAffected[0] > 0
  } catch (error) {
    console.error('Error saving evaluation result:', error)
    return false
  }
}

export async function getEvaluationResults(evaluationId: string): Promise<EvaluationResult[]> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query(`
        SELECT 
          er.id, er.evaluation_id, er.file_id,
          er.scores, er.skills_analysis, er.questions_analysis,
          er.summary, er.strengths, er.weaknesses, er.red_flags,
          er.recommendation, er.suggested_interview_questions,
          er.created_at,
          ef.file_name, ef.overall_score
        FROM evaluation_results er
        INNER JOIN evaluation_files ef ON er.file_id = ef.id
        WHERE er.evaluation_id = @evaluationId
        ORDER BY ef.overall_score DESC
      `)
    
    return result.recordset.map(row => ({
      id: row.id,
      evaluationId: row.evaluation_id,
      fileId: row.file_id,
      scores: JSON.parse(row.scores || '{}'),
      skillsAnalysis: JSON.parse(row.skills_analysis || '{}'),
      questionsAnalysis: JSON.parse(row.questions_analysis || '{}'),
      summary: row.summary,
      strengths: JSON.parse(row.strengths || '[]'),
      weaknesses: JSON.parse(row.weaknesses || '[]'),
      redFlags: JSON.parse(row.red_flags || '[]'),
      recommendation: row.recommendation,
      suggestedInterviewQuestions: JSON.parse(row.suggested_interview_questions || '[]'),
      createdAt: row.created_at
    }))
  } catch (error) {
    console.error('Error getting evaluation results:', error)
    return []
  }
}

// Helper function to calculate statistics after processing
export async function updateEvaluationStatistics(evaluationId: string): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query(`
        UPDATE evaluation_sessions
        SET 
          average_score = (
            SELECT AVG(overall_score) 
            FROM evaluation_files 
            WHERE evaluation_id = @evaluationId AND overall_score IS NOT NULL
          ),
          highest_score = (
            SELECT MAX(overall_score) 
            FROM evaluation_files 
            WHERE evaluation_id = @evaluationId AND overall_score IS NOT NULL
          ),
          lowest_score = (
            SELECT MIN(overall_score) 
            FROM evaluation_files 
            WHERE evaluation_id = @evaluationId AND overall_score IS NOT NULL
          ),
          processed_files = (
            SELECT COUNT(*) 
            FROM evaluation_files 
            WHERE evaluation_id = @evaluationId AND status = 'completed'
          ),
          failed_files = (
            SELECT COUNT(*) 
            FROM evaluation_files 
            WHERE evaluation_id = @evaluationId AND status = 'failed'
          )
        WHERE id = @evaluationId
      `)
    
    return result.rowsAffected[0] > 0
  } catch (error) {
    console.error('Error updating evaluation statistics:', error)
    return false
  }
}