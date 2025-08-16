/**
 * EVALUATION PROCESSING ENDPOINT
 * 
 * This endpoint processes evaluations by:
 * 1. Fetching the evaluation and its files
 * 2. Processing each file (extract text, analyze with AI)
 * 3. Storing results and updating progress
 * 4. Marking evaluation as completed
 */

import { NextRequest, NextResponse } from 'next/server'
import sql from 'mssql'
import { getDatabaseConfig } from '@/lib/db-config-vercel'
import { resolveUserContext } from '@/lib/auth/user-resolver'
import { HyperbolicService } from '@/lib/ai/hyperbolic-service'
import { BlobServiceClient } from '@azure/storage-blob'

// Global connection pool for serverless
let globalPool: sql.ConnectionPool | undefined

async function getConnection(): Promise<sql.ConnectionPool> {
  if (globalPool?.connected) {
    return globalPool
  }

  const dbConfig = getDatabaseConfig()
  
  if (!dbConfig.server || !dbConfig.database || !dbConfig.user || !dbConfig.password) {
    throw new Error('Database configuration missing')
  }

  const config: sql.config = {
    server: dbConfig.server,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true
    },
    pool: {
      max: 3,
      min: 0,
      idleTimeoutMillis: 10000
    }
  }

  try {
    const pool = new sql.ConnectionPool(config)
    await pool.connect()
    globalPool = pool
    return pool
  } catch (error) {
    globalPool = undefined
    throw error
  }
}

interface EvaluationFile {
  id: string
  fileName: string
  blobName: string
  status: string
  extractedText?: string
}

interface RoleSkill {
  id: string
  skillName: string
  weight: number
  isRequired: boolean
  skillCategory?: string
}

interface RoleQuestion {
  id: string
  questionText: string
  weight: number
  category?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  
  try {
    const { id: evaluationId } = await params
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(evaluationId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid evaluation ID format'
      }, { status: 400 })
    }

    const pool = await getConnection()
    
    // Get user context
    const userContext = await resolveUserContext(request)
    const userId = userContext.userId
    
    console.log(`🔄 Starting evaluation processing: ${evaluationId}`)
    
    // 1. Get evaluation details and verify ownership
    const evaluationResult = await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .input('userId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT es.*, r.title as roleTitle
        FROM evaluation_sessions es
        LEFT JOIN roles r ON es.role_id = r.id
        WHERE es.id = @evaluationId AND es.user_id = @userId
      `)
    
    if (evaluationResult.recordset.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Evaluation not found or access denied'
      }, { status: 404 })
    }
    
    const evaluation = evaluationResult.recordset[0]
    
    // Check if already processing
    if (evaluation.status === 'processing') {
      return NextResponse.json({
        success: false,
        error: 'Evaluation is already being processed'
      }, { status: 409 })
    }
    
    // Update status to processing
    await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query(`
        UPDATE evaluation_sessions 
        SET status = 'processing', started_at = GETDATE(), updated_at = GETDATE()
        WHERE id = @evaluationId
      `)
    
    // 2. Get files to process
    const filesResult = await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query(`
        SELECT id, file_name, blob_name, status, extracted_text
        FROM evaluation_files
        WHERE evaluation_id = @evaluationId
        ORDER BY created_at
      `)
    
    const files: EvaluationFile[] = filesResult.recordset
    
    if (files.length === 0) {
      // No files to process
      await pool.request()
        .input('evaluationId', sql.UniqueIdentifier, evaluationId)
        .query(`
          UPDATE evaluation_sessions 
          SET status = 'completed', completed_at = GETDATE(), updated_at = GETDATE()
          WHERE id = @evaluationId
        `)
      
      return NextResponse.json({
        success: true,
        message: 'No files to process',
        data: { processedFiles: 0, failedFiles: 0 }
      })
    }
    
    // 3. Get role skills and questions
    const [skillsResult, questionsResult] = await Promise.all([
      pool.request()
        .input('roleId', sql.UniqueIdentifier, evaluation.role_id)
        .query(`
          SELECT id, skill_name, weight, is_required, skill_category
          FROM role_skills
          WHERE role_id = @roleId
        `),
      pool.request()
        .input('roleId', sql.UniqueIdentifier, evaluation.role_id)
        .query(`
          SELECT id, question_text, weight, category
          FROM role_questions
          WHERE role_id = @roleId
        `)
    ])
    
    const roleSkills: RoleSkill[] = skillsResult.recordset.map(skill => ({
      id: skill.id,
      skillName: skill.skill_name,
      weight: skill.weight,
      isRequired: skill.is_required,
      skillCategory: skill.skill_category
    }))
    
    const roleQuestions: RoleQuestion[] = questionsResult.recordset.map(question => ({
      id: question.id,
      questionText: question.question_text,
      weight: question.weight,
      category: question.category
    }))
    
    // 4. Initialize AI service
    const aiService = new HyperbolicService()
    
    // 5. Process each file
    let processedFiles = 0
    let failedFiles = 0
    const totalFiles = files.length
    
    for (const file of files) {
      try {
        console.log(`📄 Processing file: ${file.fileName}`)
        
        // Update file status to processing
        await pool.request()
          .input('fileId', sql.UniqueIdentifier, file.id)
          .query(`
            UPDATE evaluation_files 
            SET status = 'processing', updated_at = GETDATE()
            WHERE id = @fileId
          `)
        
        // Extract text if not already done
        let extractedText = file.extractedText
        if (!extractedText && file.blobName) {
          console.log(`🔍 Extracting text from: ${file.fileName}`)
          extractedText = await extractTextFromBlob(file.blobName)
          
          // Save extracted text
          await pool.request()
            .input('fileId', sql.UniqueIdentifier, file.id)
            .input('extractedText', sql.NText, extractedText)
            .query(`
              UPDATE evaluation_files 
              SET extracted_text = @extractedText, updated_at = GETDATE()
              WHERE id = @fileId
            `)
        }
        
        if (!extractedText || extractedText.trim().length < 50) {
          throw new Error('Could not extract sufficient text from PDF')
        }
        
        // Analyze with AI
        console.log(`🤖 Analyzing with AI: ${file.fileName}`)
        const analysisResult = await aiService.analyzeResume({
          fileId: file.id,
          fileName: file.fileName,
          extractedText,
          roleSkills,
          roleQuestions
        })
        
        // Store results
        await pool.request()
          .input('id', sql.UniqueIdentifier, crypto.randomUUID())
          .input('evaluationId', sql.UniqueIdentifier, evaluationId)
          .input('fileId', sql.UniqueIdentifier, file.id)
          .input('overallScore', sql.Decimal(5, 2), analysisResult.overallScore)
          .input('skillsAnalysis', sql.NText, JSON.stringify(analysisResult.skillsAnalysis))
          .input('questionsAnalysis', sql.NText, JSON.stringify(analysisResult.questionsAnalysis))
          .input('summary', sql.NText, analysisResult.summary)
          .input('strengths', sql.NText, JSON.stringify(analysisResult.strengths))
          .input('weaknesses', sql.NText, JSON.stringify(analysisResult.weaknesses))
          .input('redFlags', sql.NText, JSON.stringify(analysisResult.redFlags))
          .input('recommendation', sql.NVarChar, analysisResult.recommendation)
          .input('suggestedQuestions', sql.NText, JSON.stringify(analysisResult.suggestedInterviewQuestions))
          .query(`
            INSERT INTO evaluation_results (
              id, evaluation_id, file_id, scores, skills_analysis, questions_analysis,
              summary, strengths, weaknesses, red_flags, recommendation, 
              suggested_interview_questions, created_at
            )
            VALUES (
              @id, @evaluationId, @fileId, @overallScore, @skillsAnalysis, @questionsAnalysis,
              @summary, @strengths, @weaknesses, @redFlags, @recommendation,
              @suggestedQuestions, GETDATE()
            )
          `)
        
        // Update file as completed
        await pool.request()
          .input('fileId', sql.UniqueIdentifier, file.id)
          .input('overallScore', sql.Decimal(5, 2), analysisResult.overallScore)
          .query(`
            UPDATE evaluation_files 
            SET status = 'completed', overall_score = @overallScore, 
                processed_at = GETDATE(), updated_at = GETDATE()
            WHERE id = @fileId
          `)
        
        processedFiles++
        console.log(`✅ Completed: ${file.fileName} (Score: ${analysisResult.overallScore})`)
        
        // Update evaluation progress
        await pool.request()
          .input('evaluationId', sql.UniqueIdentifier, evaluationId)
          .input('processedFiles', sql.Int, processedFiles)
          .input('failedFiles', sql.Int, failedFiles)
          .query(`
            UPDATE evaluation_sessions 
            SET processed_files = @processedFiles, failed_files = @failedFiles,
                updated_at = GETDATE()
            WHERE id = @evaluationId
          `)
        
      } catch (fileError) {
        console.error(`❌ Failed to process ${file.fileName}:`, fileError.message)
        
        // Mark file as failed
        await pool.request()
          .input('fileId', sql.UniqueIdentifier, file.id)
          .query(`
            UPDATE evaluation_files 
            SET status = 'failed', updated_at = GETDATE()
            WHERE id = @fileId
          `)
        
        failedFiles++
      }
    }
    
    // 6. Calculate final statistics and update evaluation
    if (processedFiles > 0) {
      const avgScoreResult = await pool.request()
        .input('evaluationId', sql.UniqueIdentifier, evaluationId)
        .query(`
          SELECT AVG(CAST(overall_score as FLOAT)) as avgScore
          FROM evaluation_files
          WHERE evaluation_id = @evaluationId AND overall_score IS NOT NULL
        `)
      
      const averageScore = avgScoreResult.recordset[0].avgScore || 0
      
      await pool.request()
        .input('evaluationId', sql.UniqueIdentifier, evaluationId)
        .input('processedFiles', sql.Int, processedFiles)
        .input('failedFiles', sql.Int, failedFiles)
        .input('averageScore', sql.Decimal(5, 2), averageScore)
        .query(`
          UPDATE evaluation_sessions 
          SET status = 'completed', processed_files = @processedFiles, 
              failed_files = @failedFiles, average_score = @averageScore,
              completed_at = GETDATE(), updated_at = GETDATE()
          WHERE id = @evaluationId
        `)
    } else {
      // All files failed
      await pool.request()
        .input('evaluationId', sql.UniqueIdentifier, evaluationId)
        .input('failedFiles', sql.Int, failedFiles)
        .query(`
          UPDATE evaluation_sessions 
          SET status = 'failed', failed_files = @failedFiles,
              updated_at = GETDATE()
          WHERE id = @evaluationId
        `)
    }
    
    console.log(`🎉 Evaluation completed: ${processedFiles}/${totalFiles} files processed`)
    
    return NextResponse.json({
      success: true,
      message: 'Evaluation processing completed',
      data: {
        evaluationId,
        totalFiles,
        processedFiles,
        failedFiles,
        processingTime: Date.now() - startTime
      }
    })
    
  } catch (error) {
    console.error('❌ Evaluation processing error:', error)
    
    // Try to mark evaluation as failed
    try {
      const pool = await getConnection()
      await pool.request()
        .input('evaluationId', sql.UniqueIdentifier, (await params).id)
        .query(`
          UPDATE evaluation_sessions 
          SET status = 'failed', updated_at = GETDATE()
          WHERE id = @evaluationId
        `)
    } catch (updateError) {
      console.error('Failed to update evaluation status:', updateError)
    }
    
    return NextResponse.json({
      success: false,
      error: 'Evaluation processing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    }, { status: 500 })
  }
}

/**
 * Extract text from blob storage
 */
async function extractTextFromBlob(blobName: string): Promise<string> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!connectionString) {
    throw new Error('Azure Storage connection string not configured')
  }
  
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient('resumes')
    const blobClient = containerClient.getBlobClient(blobName)
    
    // Download blob
    const downloadResponse = await blobClient.download()
    const buffer = await streamToBuffer(downloadResponse.readableStreamBody!)
    
    // Use pdf-parse to extract text
    const pdf = require('pdf-parse')
    const data = await pdf(buffer)
    
    return data.text || ''
  } catch (error) {
    console.error('Text extraction failed:', error)
    throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Convert stream to buffer
 */
async function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data))
    })
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
    readableStream.on('error', reject)
  })
}