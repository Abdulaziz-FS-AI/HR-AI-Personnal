import sql from 'mssql'

interface DatabaseConfig {
  server: string
  database: string
  user: string
  password: string
  pool: {
    max: number
    min: number
    idleTimeoutMillis: number
  }
  options: {
    encrypt: boolean
    trustServerCertificate: boolean
  }
}

let pool: sql.ConnectionPool | null = null

/**
 * Get database connection pool (singleton)
 */
export async function getDbPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    const config: DatabaseConfig = {
      server: process.env.DB_SERVER || '',
      database: process.env.DB_DATABASE || '',
      user: process.env.DB_USERNAME || '',
      password: process.env.DB_PASSWORD || '',
      pool: {
        max: 20,
        min: 0,
        idleTimeoutMillis: 30000
      },
      options: {
        encrypt: true,
        trustServerCertificate: false
      }
    }

    pool = new sql.ConnectionPool(config)
    await pool.connect()
  }

  return pool
}

/**
 * Execute a query with parameters
 */
export async function executeQuery<T = any>(
  query: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  const dbPool = await getDbPool()
  const request = dbPool.request()

  // Add parameters to request
  Object.entries(params).forEach(([key, value]) => {
    request.input(key, value)
  })

  const result = await request.query(query)
  return result.recordset
}

/**
 * Execute a stored procedure
 */
export async function executeStoredProcedure<T = any>(
  procedureName: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  const dbPool = await getDbPool()
  const request = dbPool.request()

  // Add parameters to request
  Object.entries(params).forEach(([key, value]) => {
    request.input(key, value)
  })

  const result = await request.execute(procedureName)
  return result.recordset
}

/**
 * Update file processing status
 */
export async function updateFileStatus(
  fileId: string,
  status: 'uploaded' | 'processing' | 'analyzed' | 'failed',
  extractedText?: string,
  errorMessage?: string
): Promise<void> {
  await executeQuery(
    `UPDATE uploaded_files 
     SET processingStatus = @status, 
         extractedText = @extractedText,
         errorMessage = @errorMessage,
         processedDate = @processedDate
     WHERE id = @fileId`,
    {
      fileId,
      status,
      extractedText: extractedText || null,
      errorMessage: errorMessage || null,
      processedDate: new Date()
    }
  )
}

/**
 * Get file details by ID
 */
export async function getFileById(fileId: string): Promise<any> {
  const result = await executeQuery(
    'SELECT * FROM uploaded_files WHERE id = @fileId',
    { fileId }
  )
  return result[0] || null
}

/**
 * Get role details with skills and questions
 */
export async function getRoleWithDetails(roleId: string): Promise<any> {
  const [role, skills, questions] = await Promise.all([
    executeQuery('SELECT * FROM roles WHERE id = @roleId', { roleId }),
    executeQuery(
      'SELECT * FROM role_skills WHERE roleId = @roleId ORDER BY weight DESC',
      { roleId }
    ),
    executeQuery(
      'SELECT * FROM role_questions WHERE roleId = @roleId ORDER BY weight DESC',
      { roleId }
    )
  ])

  if (!role[0]) return null

  return {
    ...role[0],
    skills,
    questions
  }
}

/**
 * Save analysis results
 */
export async function saveAnalysisResults(
  fileId: string,
  roleId: string,
  sessionId: string,
  analysis: any
): Promise<void> {
  const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Save main analysis result
  await executeQuery(
    `INSERT INTO resume_analysis_results (
      id, fileId, roleId, sessionId, overallScore, technicalScore, 
      experienceScore, educationScore, skillsScore, cultureFitScore,
      executiveSummary, detailedAnalysis, topStrengths, concernsGaps,
      redFlags, standoutAchievements, interviewQuestions, recommendation,
      recommendationReason, aiModelUsed, processingTimeSeconds, aiCost,
      createdDate
    ) VALUES (
      @analysisId, @fileId, @roleId, @sessionId, @overallScore, @technicalScore,
      @experienceScore, @educationScore, @skillsScore, @cultureFitScore,
      @executiveSummary, @detailedAnalysis, @topStrengths, @concernsGaps,
      @redFlags, @standoutAchievements, @interviewQuestions, @recommendation,
      @recommendationReason, @aiModelUsed, @processingTimeSeconds, @aiCost,
      @createdDate
    )`,
    {
      analysisId,
      fileId,
      roleId,
      sessionId,
      overallScore: analysis.overallScore,
      technicalScore: analysis.technicalScore,
      experienceScore: analysis.experienceScore,
      educationScore: analysis.educationScore,
      skillsScore: analysis.skillsScore,
      cultureFitScore: analysis.cultureFitScore,
      executiveSummary: analysis.executiveSummary,
      detailedAnalysis: analysis.detailedAnalysis,
      topStrengths: JSON.stringify(analysis.topStrengths),
      concernsGaps: JSON.stringify(analysis.concernsGaps),
      redFlags: JSON.stringify(analysis.redFlags),
      standoutAchievements: JSON.stringify(analysis.standoutAchievements),
      interviewQuestions: JSON.stringify(analysis.interviewQuestions),
      recommendation: analysis.recommendation,
      recommendationReason: analysis.recommendationReason,
      aiModelUsed: analysis.aiModelUsed,
      processingTimeSeconds: analysis.processingTimeSeconds,
      aiCost: analysis.aiCost,
      createdDate: new Date()
    }
  )

  // Save skills analysis
  if (analysis.matchedSkills) {
    for (const [skill, evidence] of Object.entries(analysis.matchedSkills)) {
      await executeQuery(
        `INSERT INTO skills_analysis (
          id, analysisId, skillName, isMatched, evidence, confidence, createdDate
        ) VALUES (
          @skillId, @analysisId, @skillName, @isMatched, @evidence, @confidence, @createdDate
        )`,
        {
          skillId: `skill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          analysisId,
          skillName: skill,
          isMatched: true,
          evidence: evidence as string,
          confidence: 85, // Default confidence for matched skills
          createdDate: new Date()
        }
      )
    }
  }

  // Save missing required skills
  if (analysis.missingRequiredSkills) {
    for (const skill of analysis.missingRequiredSkills) {
      await executeQuery(
        `INSERT INTO skills_analysis (
          id, analysisId, skillName, isMatched, evidence, confidence, createdDate
        ) VALUES (
          @skillId, @analysisId, @skillName, @isMatched, @evidence, @confidence, @createdDate
        )`,
        {
          skillId: `skill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          analysisId,
          skillName: skill,
          isMatched: false,
          evidence: 'Skill not found in resume',
          confidence: 90,
          createdDate: new Date()
        }
      )
    }
  }
}

/**
 * Check if session processing is complete
 */
export async function checkSessionCompletion(sessionId: string): Promise<void> {
  const stats = await executeQuery(
    `SELECT 
       COUNT(*) as totalFiles,
       SUM(CASE WHEN processingStatus = 'analyzed' THEN 1 ELSE 0 END) as completedFiles,
       SUM(CASE WHEN processingStatus = 'failed' THEN 1 ELSE 0 END) as failedFiles
     FROM uploaded_files 
     WHERE sessionId = @sessionId`,
    { sessionId }
  )

  const { totalFiles, completedFiles, failedFiles } = stats[0]

  if (completedFiles + failedFiles >= totalFiles) {
    // Session is complete, update batch session status
    await executeQuery(
      `UPDATE batch_sessions 
       SET status = @status, 
           completedAt = @completedAt,
           totalProcessed = @totalProcessed,
           totalFailed = @totalFailed
       WHERE sessionId = @sessionId`,
      {
        sessionId,
        status: failedFiles > 0 ? 'completed_with_errors' : 'completed',
        completedAt: new Date(),
        totalProcessed: completedFiles,
        totalFailed: failedFiles
      }
    )
  }
}

/**
 * Close database connections
 */
export async function closeDbConnections(): Promise<void> {
  if (pool) {
    await pool.close()
    pool = null
  }
}