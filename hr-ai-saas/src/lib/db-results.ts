import sql from 'mssql'
import { getServerConfig } from './db-config'

export interface BatchSession {
  id: string
  userId: string
  roleId: string
  totalFiles: number
  processedFiles: number
  failedFiles: number
  startedAt: Date
  completedAt?: Date
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: Date
  updatedAt: Date
}

export interface ResumeAnalysisResult {
  id: string
  fileId: string
  roleId: string
  userId: string
  batchSessionId?: string
  overallScore: number
  summary?: string
  recommendations?: string
  redFlags?: string
  totalTokensUsed: number
  analysisCompletedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface SkillAnalysis {
  id: string
  analysisResultId: string
  skillName: string
  skillCategory?: string
  found: boolean
  confidence: number
  evidence?: string
  weight: number
  isRequired: boolean
  createdAt: Date
}

export interface QuestionAnalysis {
  id: string
  analysisResultId: string
  questionText: string
  questionCategory?: string
  answer?: string
  score: number
  confidence: number
  weight: number
  createdAt: Date
}

export interface CompleteAnalysisResult {
  analysisId: string
  fileId: string
  roleId: string
  userId: string
  batchSessionId?: string
  overallScore: number
  summary?: string
  recommendations?: string
  redFlags?: string
  totalTokensUsed: number
  analysisCompletedAt: Date
  fileName?: string
  fileSize?: number
  uploadedAt?: Date
  roleName?: string
  roleDescription?: string
  skillsFoundCount: number
  totalSkillsCount: number
  avgQuestionScore?: number
}

/**
 * Create a new batch session
 */
export async function createBatchSession(session: Omit<BatchSession, 'createdAt' | 'updatedAt'>): Promise<void> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    await pool.request()
      .input('id', sql.NVarChar, session.id)
      .input('user_id', sql.NVarChar, session.userId)
      .input('role_id', sql.NVarChar, session.roleId)
      .input('total_files', sql.Int, session.totalFiles)
      .input('processed_files', sql.Int, session.processedFiles)
      .input('failed_files', sql.Int, session.failedFiles)
      .input('started_at', sql.DateTime2, session.startedAt)
      .input('completed_at', sql.DateTime2, session.completedAt)
      .input('status', sql.NVarChar, session.status)
      .query(`
        INSERT INTO batch_sessions (
          id, user_id, role_id, total_files, processed_files, failed_files,
          started_at, completed_at, status
        ) VALUES (
          @id, @user_id, @role_id, @total_files, @processed_files, @failed_files,
          @started_at, @completed_at, @status
        )
      `)
  } finally {
    await pool.close()
  }
}

/**
 * Update batch session
 */
export async function updateBatchSession(
  sessionId: string, 
  updates: Partial<Pick<BatchSession, 'processedFiles' | 'failedFiles' | 'completedAt' | 'status'>>
): Promise<void> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    const request = pool.request().input('id', sql.NVarChar, sessionId)
    
    const setParts: string[] = ['updated_at = GETDATE()']
    
    if (updates.processedFiles !== undefined) {
      request.input('processed_files', sql.Int, updates.processedFiles)
      setParts.push('processed_files = @processed_files')
    }
    
    if (updates.failedFiles !== undefined) {
      request.input('failed_files', sql.Int, updates.failedFiles)
      setParts.push('failed_files = @failed_files')
    }
    
    if (updates.completedAt !== undefined) {
      request.input('completed_at', sql.DateTime2, updates.completedAt)
      setParts.push('completed_at = @completed_at')
    }
    
    if (updates.status !== undefined) {
      request.input('status', sql.NVarChar, updates.status)
      setParts.push('status = @status')
    }

    await request.query(`
      UPDATE batch_sessions 
      SET ${setParts.join(', ')}
      WHERE id = @id
    `)
  } finally {
    await pool.close()
  }
}

/**
 * Get batch session by ID
 */
export async function getBatchSession(sessionId: string): Promise<BatchSession | null> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    const result = await pool.request()
      .input('id', sql.NVarChar, sessionId)
      .query(`
        SELECT * FROM batch_sessions WHERE id = @id
      `)

    if (result.recordset.length === 0) {
      return null
    }

    const row = result.recordset[0]
    return {
      id: row.id,
      userId: row.user_id,
      roleId: row.role_id,
      totalFiles: row.total_files,
      processedFiles: row.processed_files,
      failedFiles: row.failed_files,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  } finally {
    await pool.close()
  }
}

/**
 * Store analysis result
 */
export async function storeAnalysisResult(
  result: Omit<ResumeAnalysisResult, 'id' | 'createdAt' | 'updatedAt'>,
  skillsAnalysis: Array<Omit<SkillAnalysis, 'id' | 'analysisResultId' | 'createdAt'>>,
  questionsAnalysis: Array<Omit<QuestionAnalysis, 'id' | 'analysisResultId' | 'createdAt'>>
): Promise<string> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    // Start transaction
    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      // Insert main analysis result
      const analysisResult = await transaction.request()
        .input('file_id', sql.NVarChar, result.fileId)
        .input('role_id', sql.NVarChar, result.roleId)
        .input('user_id', sql.NVarChar, result.userId)
        .input('batch_session_id', sql.NVarChar, result.batchSessionId)
        .input('overall_score', sql.Int, result.overallScore)
        .input('summary', sql.NText, result.summary)
        .input('recommendations', sql.NText, result.recommendations)
        .input('red_flags', sql.NText, result.redFlags)
        .input('total_tokens_used', sql.Int, result.totalTokensUsed)
        .input('analysis_completed_at', sql.DateTime2, result.analysisCompletedAt)
        .query(`
          INSERT INTO resume_analysis_results (
            file_id, role_id, user_id, batch_session_id, overall_score, 
            summary, recommendations, red_flags, total_tokens_used, analysis_completed_at
          ) 
          OUTPUT INSERTED.id
          VALUES (
            @file_id, @role_id, @user_id, @batch_session_id, @overall_score,
            @summary, @recommendations, @red_flags, @total_tokens_used, @analysis_completed_at
          )
        `)

      const analysisResultId = analysisResult.recordset[0].id

      // Insert skills analysis
      for (const skill of skillsAnalysis) {
        await transaction.request()
          .input('analysis_result_id', sql.NVarChar, analysisResultId)
          .input('skill_name', sql.NVarChar, skill.skillName)
          .input('skill_category', sql.NVarChar, skill.skillCategory)
          .input('found', sql.Bit, skill.found)
          .input('confidence', sql.Int, skill.confidence)
          .input('evidence', sql.NText, skill.evidence)
          .input('weight', sql.Int, skill.weight)
          .input('is_required', sql.Bit, skill.isRequired)
          .query(`
            INSERT INTO skills_analysis (
              analysis_result_id, skill_name, skill_category, found, 
              confidence, evidence, weight, is_required
            ) VALUES (
              @analysis_result_id, @skill_name, @skill_category, @found,
              @confidence, @evidence, @weight, @is_required
            )
          `)
      }

      // Insert questions analysis
      for (const question of questionsAnalysis) {
        await transaction.request()
          .input('analysis_result_id', sql.NVarChar, analysisResultId)
          .input('question_text', sql.NText, question.questionText)
          .input('question_category', sql.NVarChar, question.questionCategory)
          .input('answer', sql.NText, question.answer)
          .input('score', sql.Int, question.score)
          .input('confidence', sql.Int, question.confidence)
          .input('weight', sql.Int, question.weight)
          .query(`
            INSERT INTO questions_analysis (
              analysis_result_id, question_text, question_category, 
              answer, score, confidence, weight
            ) VALUES (
              @analysis_result_id, @question_text, @question_category,
              @answer, @score, @confidence, @weight
            )
          `)
      }

      await transaction.commit()
      return analysisResultId

    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } finally {
    await pool.close()
  }
}

/**
 * Get complete analysis results for a role
 */
export async function getAnalysisResultsByRole(
  roleId: string, 
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<CompleteAnalysisResult[]> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    const result = await pool.request()
      .input('role_id', sql.NVarChar, roleId)
      .input('user_id', sql.NVarChar, userId)
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query(`
        SELECT * FROM vw_complete_analysis_results 
        WHERE role_id = @role_id AND user_id = @user_id
        ORDER BY overall_score DESC, analysis_completed_at DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `)

    return result.recordset.map(row => ({
      analysisId: row.analysis_id,
      fileId: row.file_id,
      roleId: row.role_id,
      userId: row.user_id,
      batchSessionId: row.batch_session_id,
      overallScore: row.overall_score,
      summary: row.summary,
      recommendations: row.recommendations,
      redFlags: row.red_flags,
      totalTokensUsed: row.total_tokens_used,
      analysisCompletedAt: row.analysis_completed_at,
      fileName: row.file_name,
      fileSize: row.file_size,
      uploadedAt: row.uploaded_at,
      roleName: row.role_name,
      roleDescription: row.role_description,
      skillsFoundCount: row.skills_found_count || 0,
      totalSkillsCount: row.total_skills_count || 0,
      avgQuestionScore: row.avg_question_score
    }))
  } finally {
    await pool.close()
  }
}

/**
 * Get detailed analysis result with skills and questions
 */
export async function getDetailedAnalysisResult(analysisId: string): Promise<{
  result: ResumeAnalysisResult
  skills: SkillAnalysis[]
  questions: QuestionAnalysis[]
} | null> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    // Get main result
    const resultQuery = await pool.request()
      .input('id', sql.NVarChar, analysisId)
      .query(`SELECT * FROM resume_analysis_results WHERE id = @id`)

    if (resultQuery.recordset.length === 0) {
      return null
    }

    const resultRow = resultQuery.recordset[0]
    const result: ResumeAnalysisResult = {
      id: resultRow.id,
      fileId: resultRow.file_id,
      roleId: resultRow.role_id,
      userId: resultRow.user_id,
      batchSessionId: resultRow.batch_session_id,
      overallScore: resultRow.overall_score,
      summary: resultRow.summary,
      recommendations: resultRow.recommendations,
      redFlags: resultRow.red_flags,
      totalTokensUsed: resultRow.total_tokens_used,
      analysisCompletedAt: resultRow.analysis_completed_at,
      createdAt: resultRow.created_at,
      updatedAt: resultRow.updated_at
    }

    // Get skills analysis
    const skillsQuery = await pool.request()
      .input('analysis_result_id', sql.NVarChar, analysisId)
      .query(`SELECT * FROM skills_analysis WHERE analysis_result_id = @analysis_result_id ORDER BY weight DESC`)

    const skills: SkillAnalysis[] = skillsQuery.recordset.map(row => ({
      id: row.id,
      analysisResultId: row.analysis_result_id,
      skillName: row.skill_name,
      skillCategory: row.skill_category,
      found: row.found,
      confidence: row.confidence,
      evidence: row.evidence,
      weight: row.weight,
      isRequired: row.is_required,
      createdAt: row.created_at
    }))

    // Get questions analysis
    const questionsQuery = await pool.request()
      .input('analysis_result_id', sql.NVarChar, analysisId)
      .query(`SELECT * FROM questions_analysis WHERE analysis_result_id = @analysis_result_id ORDER BY weight DESC`)

    const questions: QuestionAnalysis[] = questionsQuery.recordset.map(row => ({
      id: row.id,
      analysisResultId: row.analysis_result_id,
      questionText: row.question_text,
      questionCategory: row.question_category,
      answer: row.answer,
      score: row.score,
      confidence: row.confidence,
      weight: row.weight,
      createdAt: row.created_at
    }))

    return { result, skills, questions }
  } finally {
    await pool.close()
  }
}