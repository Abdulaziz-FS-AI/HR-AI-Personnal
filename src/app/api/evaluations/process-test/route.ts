import { NextRequest, NextResponse } from 'next/server'
import { EvaluationFileUploader } from '@/lib/azure/evaluation-uploader'
import { PDFTextExtractor } from '@/lib/services/pdf-text-extractor'
import { EvaluationAnalyzer } from '@/lib/ai/evaluation-analyzer'
import sql from 'mssql'
import { getDbConnection } from '@/lib/db'

// Test endpoint without authentication for development
export const maxDuration = 300

export async function POST(request: NextRequest) {
  let pool: sql.ConnectionPool | null = null
  
  try {
    const body = await request.json()
    const { evaluationId, files } = body
    
    // Use a test user ID for development
    // Use actual test user ID from database
    const testUserId = '5A5D9AC4-48BB-4117-89F2-5B1D8FC383B8'
    
    if (!evaluationId || !files || files.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid request data' },
        { status: 400 }
      )
    }

    pool = await getDbConnection()
    
    // Get evaluation details (without user check for testing)
    const evalCheck = await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query(`
        SELECT 
          es.*, 
          r.title as roleTitle,
          r.id as roleId
        FROM evaluation_sessions es
        JOIN roles r ON es.role_id = r.id
        WHERE es.id = @evaluationId
      `)
    
    if (evalCheck.recordset.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Evaluation not found' },
        { status: 404 }
      )
    }

    const evaluation = evalCheck.recordset[0]
    const fileCount = files.length

    console.log(`📋 TEST MODE: Processing ${fileCount} files for evaluation ${evaluationId}`)

    // Update evaluation status
    await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .input('status', sql.NVarChar, 'processing')
      .input('totalFiles', sql.Int, fileCount)
      .query(`
        UPDATE evaluation_sessions 
        SET status = @status, 
            total_files = @totalFiles,
            updated_at = GETDATE()
        WHERE id = @evaluationId
      `)

    // Process files directly (simplified for testing)
    const uploader = new EvaluationFileUploader()
    const pdfExtractor = new PDFTextExtractor()
    const analyzer = new EvaluationAnalyzer()

    // Load role skills
    const skillsResult = await pool.request()
      .input('roleId', sql.UniqueIdentifier, evaluation.roleId)
      .query(`
        SELECT skill_name, weight, is_required
        FROM role_skills
        WHERE role_id = @roleId
      `)

    const skills = skillsResult.recordset.map(s => ({
      skillName: s.skill_name,
      weight: s.weight,
      isRequired: s.is_required
    }))

    let processedCount = 0
    let failedCount = 0

    // Process each file
    for (const file of files) {
      try {
        // Convert base64 to buffer
        const fileBuffer = Buffer.from(file.content, 'base64')
        
        // Upload to Azure
        const uploadResult = await uploader.uploadFile(
          fileBuffer,
          file.filename || file.name,
          'application/pdf',
          testUserId,
          evaluationId
        )

        // Extract text
        const textResult = await pdfExtractor.extractText(fileBuffer)

        // Analyze with AI (or mock for testing)
        let analysisResult
        try {
          analysisResult = await analyzer.analyzeResume(
            testUserId,
            textResult.fullText,
            {
              title: evaluation.roleTitle,
              skills: skills,
              questions: []
            }
          )
        } catch (aiError) {
          // Mock result if AI fails
          console.log('AI analysis failed, using mock result')
          analysisResult = {
            overallScore: Math.random() * 100,
            skillMatches: skills.map(s => ({
              skill: s.skillName,
              found: Math.random() > 0.5,
              confidence: Math.random() * 100
            })),
            questionAnswers: [],
            strengths: ['Mock strength'],
            redFlags: [],
            recommendations: 'Mock recommendation'
          }
        }

        // Save file record
        const fileId = crypto.randomUUID()
        await pool!.request()
          .input('fileId', sql.UniqueIdentifier, fileId)
          .input('evaluationId', sql.UniqueIdentifier, evaluationId)
          .input('fileName', sql.NVarChar, file.filename || file.name)
          .input('fileSize', sql.BigInt, file.size || fileBuffer.length)
          .input('blobName', sql.NVarChar, uploadResult.blobUrl)
          .input('extractedText', sql.NText, textResult.fullText)
          .input('overallScore', sql.Float, analysisResult.overallScore)
          .query(`
            INSERT INTO evaluation_files (
              id, evaluation_id, file_name, file_size, blob_name, 
              status, extracted_text, overall_score,
              created_at, processed_at
            ) VALUES (
              @fileId, @evaluationId, @fileName, @fileSize, @blobName,
              'completed', @extractedText, @overallScore, 
              GETDATE(), GETDATE()
            )
          `)

        // Save result
        await pool!.request()
          .input('evaluationId', sql.UniqueIdentifier, evaluationId)
          .input('fileId', sql.UniqueIdentifier, fileId)
          .input('skillsAnalysis', sql.NVarChar(sql.MAX), JSON.stringify(analysisResult.skillMatches))
          .input('recommendation', sql.NText, analysisResult.recommendations)
          .query(`
            INSERT INTO evaluation_results (
              id, evaluation_id, file_id, 
              skills_analysis, recommendation, created_at
            ) VALUES (
              NEWID(), @evaluationId, @fileId,
              @skillsAnalysis, @recommendation, GETDATE()
            )
          `)

        processedCount++
      } catch (error) {
        failedCount++
        console.error(`Failed to process file:`, error)
      }
    }

    // Update evaluation status
    const finalStatus = failedCount === 0 ? 'completed' : 'failed'
    await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .input('status', sql.NVarChar, finalStatus)
      .input('processedCount', sql.Int, processedCount)
      .input('failedCount', sql.Int, failedCount)
      .query(`
        UPDATE evaluation_sessions 
        SET status = @status,
            processed_files = @processedCount,
            failed_files = @failedCount,
            completed_at = GETDATE()
        WHERE id = @evaluationId
      `)

    return NextResponse.json({
      success: true,
      message: `TEST MODE: Processed ${processedCount} of ${fileCount} files`,
      data: {
        evaluationId,
        processedCount,
        failedCount
      }
    })

  } catch (error) {
    console.error('Test processing error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to process evaluation',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  } finally {
    if (pool) {
      await pool.close()
    }
  }
}