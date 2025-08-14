import { NextRequest, NextResponse } from 'next/server'
import { requireUserContext } from '@/lib/security/user-context'
import { withRateLimit } from '@/lib/security/rate-limit'
import { evaluationQueue } from '@/lib/azure/evaluation-queue'
import { EvaluationFileUploader } from '@/lib/azure/evaluation-uploader'
import { PDFTextExtractor } from '@/lib/services/pdf-text-extractor'
import { EvaluationAnalyzer } from '@/lib/ai/evaluation-analyzer'
import sql from 'mssql'
import { getDbConnection } from '@/lib/db'

// Increased timeout for fallback processing (Vercel Hobby limit: 300s)
export const maxDuration = 300 // 5 minutes

export async function POST(request: NextRequest) {
  let pool: sql.ConnectionPool | null = null
  let evaluationId: string | null = null
  
  try {
    // Use consistent authentication
    const userContext = await requireUserContext(request)
    
    // Apply rate limiting
    const rateLimitCheck = await withRateLimit(
      request,
      userContext.userId,
      userContext.subscriptionTier,
      'create'
    )
    if (!rateLimitCheck.allowed) return rateLimitCheck.response

    const body = await request.json()
    evaluationId = body.evaluationId
    const files = body.files
    
    if (!evaluationId || !files || files.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid request data' },
        { status: 400 }
      )
    }

    pool = await getDbConnection()
    
    // Verify evaluation belongs to user and get details
    const evalCheck = await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .input('userId', sql.UniqueIdentifier, userContext.userId)
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

    // Determine processing strategy based on file count
    const useQueue = fileCount > 10 && evaluationQueue.isAvailable()

    if (useQueue) {
      // QUEUE MODE: Send to Azure Service Bus for async processing
      console.log(`🚀 Using queue mode for ${fileCount} files`)

      const queueResult = await evaluationQueue.queueEvaluation({
        evaluationId,
        roleId: evaluation.roleId,
        userId: userContext.userId,
        userEmail: evaluation.userEmail || userContext.email || '',
        roleTitle: evaluation.roleTitle,
        files: files.map((file: any) => ({
          id: file.id || crypto.randomUUID(),
          filename: file.filename || file.name,
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
      .input('roleId', sql.UniqueIdentifier, evaluation.roleId)
      .query(`
        SELECT id, skill_name, weight, is_required
        FROM role_skills
        WHERE role_id = @roleId
        ORDER BY weight DESC
      `)

    const questionsResult = await pool.request()
      .input('roleId', sql.UniqueIdentifier, evaluation.roleId)
      .query(`
        SELECT id, question_text, weight
        FROM role_questions
        WHERE role_id = @roleId
        ORDER BY weight DESC
      `)

    const skills = skillsResult.recordset.map(s => ({
      skillName: s.skill_name,
      weight: s.weight,
      isRequired: s.is_required
    }))

    const questions = questionsResult.recordset.map(q => ({
      questionText: q.question_text,
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
          // Upload file - handle both base64 and buffer formats
          let fileBuffer: Buffer
          if (typeof file.content === 'string') {
            // Handle base64 string (may have data:...;base64, prefix)
            const base64Data = file.content.includes(',') 
              ? file.content.split(',')[1] 
              : file.content
            fileBuffer = Buffer.from(base64Data, 'base64')
          } else if (Buffer.isBuffer(file.content)) {
            fileBuffer = file.content
          } else {
            throw new Error('Invalid file content format')
          }
          const uploadResult = await uploader.uploadFile(
            fileBuffer,
            file.filename || file.name,
            'application/pdf',
            userContext.userId,
            evaluationId
          )

          if (!uploadResult.blobUrl) {
            throw new Error('File upload failed')
          }

          // Extract text (reuse the buffer we already created)
          const textResult = await pdfExtractor.extractText(fileBuffer)

          if (!textResult.fullText) {
            throw new Error('Failed to extract text from PDF')
          }

          // Analyze with AI
          const analysisResult = await analyzer.analyzeResume(
            userContext.userId,
            textResult.fullText,
            {
              title: evaluation.roleTitle,
              skills: skills,
              questions: questions
            }
          )

          // Save file record to existing evaluation_files table
          const fileId = crypto.randomUUID()
          
          // Parse candidate info from extracted text if possible
          const candidateInfo = {
            name: file.filename?.replace('.pdf', '') || 'Unknown',
            email: textResult.contact?.email || null,
            phone: textResult.contact?.phone || null
          }
          
          await pool!.request()
            .input('fileId', sql.UniqueIdentifier, fileId)
            .input('evaluationId', sql.UniqueIdentifier, evaluationId)
            .input('fileName', sql.NVarChar, file.filename || file.name)
            .input('fileSize', sql.BigInt, file.size || 0)
            .input('blobName', sql.NVarChar, uploadResult.blobUrl)
            .input('extractedText', sql.NText, textResult.fullText)
            .input('candidateInfo', sql.NVarChar(sql.MAX), JSON.stringify(candidateInfo))
            .input('overallScore', sql.Float, analysisResult.overallScore)
            .query(`
              INSERT INTO evaluation_files (
                id, evaluation_id, file_name, file_size, blob_name, 
                status, extracted_text, candidate_info, overall_score, 
                created_at, processed_at
              ) VALUES (
                @fileId, @evaluationId, @fileName, @fileSize, @blobName,
                'completed', @extractedText, @candidateInfo, @overallScore, 
                GETDATE(), GETDATE()
              )
            `)

          // Save evaluation result to existing table structure
          await pool!.request()
            .input('evaluationId', sql.UniqueIdentifier, evaluationId)
            .input('fileId', sql.UniqueIdentifier, fileId)
            .input('skillsAnalysis', sql.NVarChar(sql.MAX), JSON.stringify(analysisResult.skillMatches))
            .input('questionsAnalysis', sql.NVarChar(sql.MAX), JSON.stringify(analysisResult.questionAnswers))
            .input('strengths', sql.NVarChar(sql.MAX), JSON.stringify(analysisResult.strengths))
            .input('weaknesses', sql.NVarChar(sql.MAX), JSON.stringify(analysisResult.weaknesses || []))
            .input('redFlags', sql.NVarChar(sql.MAX), JSON.stringify(analysisResult.redFlags))
            .input('recommendation', sql.NText, analysisResult.recommendations)
            .query(`
              INSERT INTO evaluation_results (
                id, evaluation_id, file_id, 
                skills_analysis, questions_analysis,
                strengths, weaknesses, red_flags, 
                recommendation, created_at
              ) VALUES (
                NEWID(), @evaluationId, @fileId,
                @skillsAnalysis, @questionsAnalysis,
                @strengths, @weaknesses, @redFlags,
                @recommendation, GETDATE()
              )
            `)

          processedCount++
          return { success: true, fileId: fileId }

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
    const finalStatus = failedCount === 0 ? 'completed' : (processedCount > 0 ? 'completed' : 'failed')
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
    
    // Try to update evaluation status to failed (evaluationId is already available in scope)
    if (pool && evaluationId) {
      try {
        await pool.request()
          .input('evaluationId', sql.UniqueIdentifier, evaluationId)
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