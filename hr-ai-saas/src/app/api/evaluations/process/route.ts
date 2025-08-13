import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { evaluationQueue } from '@/lib/azure/evaluation-queue'
import { EvaluationFileUploader } from '@/lib/azure/evaluation-uploader'
import { PDFTextExtractor } from '@/lib/services/pdf-text-extractor'
import { EvaluationAnalyzer } from '@/lib/ai/evaluation-analyzer'
import sql from 'mssql'
import { getDbConnection } from '@/lib/db'

// Increased timeout for fallback processing
export const maxDuration = 600 // 10 minutes

export async function POST(request: NextRequest) {
  let pool: sql.ConnectionPool | null = null
  
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      )
    }

    const { evaluationId, files } = await request.json()
    
    if (!evaluationId || !files || files.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid request data' },
        { status: 400 }
      )
    }

    pool = await getDbConnection()
    
    // Verify evaluation belongs to user and get details
    const evalCheck = await pool.request()
      .input('evaluationId', sql.NVarChar, evaluationId)
      .input('userId', sql.NVarChar, session.user.id)
      .query(`
        SELECT 
          es.*, 
          r.title as roleTitle,
          r.id as roleId,
          u.email as userEmail
        FROM evaluation_sessions es
        JOIN roles r ON es.role_id = r.id
        JOIN users u ON es.user_id = u.id
        WHERE es.id = @evaluationId AND es.user_id = @userId
      `)
    
    if (evalCheck.recordset.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Evaluation not found' },
        { status: 404 }
      )
    }

    const evaluation = evalCheck.recordset[0]
    const fileCount = files.length

    console.log(`📋 Processing evaluation ${evaluationId} with ${fileCount} files`)

    // Update evaluation status
    await pool.request()
      .input('evaluationId', sql.NVarChar, evaluationId)
      .input('status', sql.NVarChar, 'processing')
      .input('totalFiles', sql.Int, fileCount)
      .query(`
        UPDATE evaluation_sessions 
        SET status = @status, 
            total_files = @totalFiles,
            updated_at = GETDATE()
        WHERE id = @evaluationId
      `)

    // Determine processing strategy based on file count
    const useQueue = fileCount > 10 && evaluationQueue.isAvailable()

    if (useQueue) {
      // QUEUE MODE: Send to Azure Service Bus for async processing
      console.log(`🚀 Using queue mode for ${fileCount} files`)

      const queueResult = await evaluationQueue.queueEvaluation({
        evaluationId,
        roleId: evaluation.roleId,
        userId: session.user.id,
        userEmail: evaluation.userEmail || session.user.email || '',
        roleTitle: evaluation.roleTitle,
        files: files.map((file: any) => ({
          id: file.id || `file-${Date.now()}-${Math.random()}`,
          filename: file.filename,
          content: file.content // Already base64 from frontend
        })),
        timestamp: new Date().toISOString()
      })

      if (queueResult.success) {
        return NextResponse.json({
          success: true,
          message: `${fileCount} files queued for processing. You'll be notified when complete.`,
          data: {
            evaluationId,
            mode: 'async',
            estimatedTime: `${Math.ceil(fileCount * 1.5)} minutes`,
            notification: 'email'
          }
        })
      } else {
        console.warn('⚠️ Queue failed, falling back to direct processing')
        // Fall through to direct processing
      }
    }

    // DIRECT MODE: Process immediately (for small batches or queue failure)
    console.log(`⚡ Using direct mode for ${fileCount} files`)

    if (fileCount > 50) {
      return NextResponse.json({
        success: false,
        message: 'Too many files for direct processing. Please try again later or process in smaller batches.',
        data: {
          maxFiles: 50,
          providedFiles: fileCount
        }
      }, { status: 400 })
    }

    // Process files directly
    const uploader = new EvaluationFileUploader()
    const pdfExtractor = new PDFTextExtractor()
    const analyzer = new EvaluationAnalyzer()

    // Load role skills and questions
    const skillsResult = await pool.request()
      .input('roleId', sql.NVarChar, evaluation.roleId)
      .query(`
        SELECT id, skill_name, weight, is_required
        FROM role_skills
        WHERE role_id = @roleId
        ORDER BY weight DESC
      `)

    const questionsResult = await pool.request()
      .input('roleId', sql.NVarChar, evaluation.roleId)
      .query(`
        SELECT id, question_text, weight
        FROM role_questions
        WHERE role_id = @roleId
        ORDER BY weight DESC
      `)

    const skills = skillsResult.recordset.map(s => ({
      name: s.skill_name,
      weight: s.weight,
      required: s.is_required
    }))

    const questions = questionsResult.recordset.map(q => ({
      text: q.question_text,
      weight: q.weight
    }))

    let processedCount = 0
    let failedCount = 0
    const errors: any[] = []

    // Process files with concurrency control
    const BATCH_SIZE = 5
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE)
      
      const batchPromises = batch.map(async (file: any) => {
        try {
          // Upload file
          const uploadResult = await uploader.uploadEvaluationFile(
            evaluationId,
            file.filename,
            Buffer.from(file.content.split(',')[1] || file.content, 'base64')
          )

          if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Upload failed')
          }

          // Extract text
          const fileBuffer = Buffer.from(file.content.split(',')[1] || file.content, 'base64')
          const textResult = await pdfExtractor.extractText(fileBuffer)

          if (!textResult.success || !textResult.text) {
            throw new Error('Failed to extract text from PDF')
          }

          // Analyze with AI
          const analysisResult = await analyzer.analyzeResume(
            textResult.text,
            evaluation.roleId,
            skills,
            questions
          )

          // Save result to database
          await pool!.request()
            .input('evaluationId', sql.NVarChar, evaluationId)
            .input('fileId', sql.NVarChar, uploadResult.fileId)
            .input('filename', sql.NVarChar, file.filename)
            .input('overallScore', sql.Int, analysisResult.overallScore)
            .input('skillsAnalysis', sql.NVarChar, JSON.stringify(analysisResult.skillsAnalysis))
            .input('questionsAnalysis', sql.NVarChar, JSON.stringify(analysisResult.questionsAnalysis))
            .input('recommendations', sql.NVarChar, JSON.stringify(analysisResult.recommendations))
            .input('redFlags', sql.NVarChar, JSON.stringify(analysisResult.redFlags))
            .input('extractedText', sql.NText, textResult.text)
            .query(`
              INSERT INTO evaluation_results (
                id, evaluation_id, file_id, filename, overall_score,
                skills_analysis, questions_analysis, recommendations, red_flags,
                extracted_text, created_at
              ) VALUES (
                NEWID(), @evaluationId, @fileId, @filename, @overallScore,
                @skillsAnalysis, @questionsAnalysis, @recommendations, @redFlags,
                @extractedText, GETDATE()
              )
            `)

          processedCount++
          return { success: true, fileId: uploadResult.fileId }

        } catch (error) {
          failedCount++
          console.error(`Failed to process ${file.filename}:`, error)
          errors.push({
            filename: file.filename,
            error: error instanceof Error ? error.message : 'Processing failed'
          })
          return { success: false, error }
        }
      })

      await Promise.all(batchPromises)
    }

    // Update evaluation status
    const finalStatus = failedCount === 0 ? 'completed' : 'completed_with_errors'
    await pool.request()
      .input('evaluationId', sql.NVarChar, evaluationId)
      .input('status', sql.NVarChar, finalStatus)
      .input('processedCount', sql.Int, processedCount)
      .input('failedCount', sql.Int, failedCount)
      .query(`
        UPDATE evaluation_sessions 
        SET status = @status,
            files_processed = @processedCount,
            files_failed = @failedCount,
            completed_at = GETDATE(),
            updated_at = GETDATE()
        WHERE id = @evaluationId
      `)

    return NextResponse.json({
      success: failedCount === 0,
      message: `Processed ${processedCount} of ${fileCount} files successfully`,
      data: {
        evaluationId,
        mode: 'direct',
        processedCount,
        failedCount,
        errors: errors.length > 0 ? errors : undefined
      }
    })

  } catch (error) {
    console.error('Error processing evaluation:', error)
    
    // Try to update evaluation status to failed
    if (pool) {
      try {
        const { evaluationId } = await request.json()
        await pool.request()
          .input('evaluationId', sql.NVarChar, evaluationId)
          .input('status', sql.NVarChar, 'failed')
          .query(`
            UPDATE evaluation_sessions 
            SET status = @status, 
                updated_at = GETDATE()
            WHERE id = @evaluationId
          `)
      } catch (updateError) {
        console.error('Failed to update evaluation status:', updateError)
      }
    }

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