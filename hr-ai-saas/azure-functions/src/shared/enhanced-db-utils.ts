import sql from 'mssql'

const config: sql.config = {
  server: process.env.DB_SERVER || '',
  database: process.env.DB_DATABASE || '',
  user: process.env.DB_USERNAME || '',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
}

let pool: sql.ConnectionPool | null = null

export async function getDbConnection(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = await sql.connect(config)
  }
  return pool
}

export async function updateEvaluationStatus(
  pool: sql.ConnectionPool,
  evaluationId: string,
  updates: {
    status: string
    filesProcessed?: number
    filesFailed?: number
    completedAt?: Date
  }
): Promise<void> {
  const request = pool.request()
    .input('evaluationId', sql.NVarChar, evaluationId)
    .input('status', sql.NVarChar, updates.status)
  
  let updateClauses = ['status = @status']
  
  if (updates.filesProcessed !== undefined) {
    request.input('filesProcessed', sql.Int, updates.filesProcessed)
    updateClauses.push('files_processed = @filesProcessed')
  }
  
  if (updates.filesFailed !== undefined) {
    request.input('filesFailed', sql.Int, updates.filesFailed)
    updateClauses.push('files_failed = @filesFailed')
  }
  
  if (updates.completedAt) {
    request.input('completedAt', sql.DateTime, updates.completedAt)
    updateClauses.push('completed_at = @completedAt')
  }
  
  updateClauses.push('updated_at = GETDATE()')
  
  const query = `
    UPDATE evaluation_sessions 
    SET ${updateClauses.join(', ')}
    WHERE id = @evaluationId
  `
  
  await request.query(query)
}

export async function saveEvaluationResult(
  pool: sql.ConnectionPool,
  result: {
    evaluationId: string
    fileId: string
    filename: string
    overallScore: number
    skillsAnalysis: string
    questionsAnalysis: string
    recommendations: string
    redFlags: string
    extractedText: string
  }
): Promise<void> {
  await pool.request()
    .input('id', sql.NVarChar, `result-${Date.now()}-${Math.random()}`)
    .input('evaluationId', sql.NVarChar, result.evaluationId)
    .input('fileId', sql.NVarChar, result.fileId)
    .input('filename', sql.NVarChar, result.filename)
    .input('overallScore', sql.Int, result.overallScore)
    .input('skillsAnalysis', sql.NVarChar, result.skillsAnalysis)
    .input('questionsAnalysis', sql.NVarChar, result.questionsAnalysis)
    .input('recommendations', sql.NVarChar, result.recommendations)
    .input('redFlags', sql.NVarChar, result.redFlags)
    .input('extractedText', sql.NText, result.extractedText)
    .query(`
      INSERT INTO evaluation_results (
        id, evaluation_id, file_id, filename, overall_score,
        skills_analysis, questions_analysis, recommendations, red_flags,
        extracted_text, created_at
      ) VALUES (
        @id, @evaluationId, @fileId, @filename, @overallScore,
        @skillsAnalysis, @questionsAnalysis, @recommendations, @redFlags,
        @extractedText, GETDATE()
      )
    `)
}