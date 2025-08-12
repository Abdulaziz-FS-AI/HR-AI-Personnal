import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { EvaluationFileUploader } from '@/lib/azure/evaluation-uploader'
import { PDFTextExtractor } from '@/lib/services/pdf-text-extractor'
import { EvaluationAnalyzer } from '@/lib/ai/evaluation-analyzer'
import sql from 'mssql'
import { getDbConnection } from '@/lib/db'

export const maxDuration = 300 // 5 minutes max for processing

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
    
    // Verify evaluation belongs to user
    const evalCheck = await pool.request()
      .input('evaluationId', sql.NVarChar, evaluationId)
      .input('userId', sql.NVarChar, session.user.id)
      .query(`
        SELECT es.*, r.title as roleTitle
        FROM evaluation_sessions es
        JOIN roles r ON es.role_id = r.id
        WHERE es.id = @evaluationId AND es.user_id = @userId
      `)
    
    if (evalCheck.recordset.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Evaluation not found' },
        { status: 404 }
      )
    }

    const evaluation = evalCheck.recordset[0]
    
    // Get role details with skills and questions
    const roleData = await pool.request()
      .input('roleId', sql.NVarChar, evaluation.role_id)
      .query(`
        SELECT 
          r.title,
          r.min_experience_years,
          r.max_experience_years,
          r.education_requirements,
          (
            SELECT skill_name as skillName, weight, is_required as isRequired
            FROM role_skills
            WHERE role_id = r.id
            FOR JSON PATH
          ) as skills,
          (
            SELECT question_text as questionText, weight
            FROM role_questions
            WHERE role_id = r.id AND is_active = 1
            FOR JSON PATH
          ) as questions
        FROM roles r
        WHERE r.id = @roleId
      `)
    
    const role = {
      title: roleData.recordset[0].title,
      skills: JSON.parse(roleData.recordset[0].skills || '[]'),
      questions: JSON.parse(roleData.recordset[0].questions || '[]'),
      requirements: {
        experience: {
          min: roleData.recordset[0].min_experience_years || 0,
          max: roleData.recordset[0].max_experience_years || 10
        },
        education: roleData.recordset[0].education_requirements
      }
    }

    // Initialize services
    const uploader = new EvaluationFileUploader()
    const extractor = new PDFTextExtractor()
    const analyzer = new EvaluationAnalyzer()
    
    // Update evaluation status to processing
    await pool.request()
      .input('evaluationId', sql.NVarChar, evaluationId)
      .input('status', sql.NVarChar, 'processing')
      .query(`
        UPDATE evaluation_sessions 
        SET status = @status, updated_at = GETUTCDATE()
        WHERE id = @evaluationId
      `)

    let processedCount = 0
    let failedCount = 0
    const results = []

    // Process each file
    for (const file of files) {
      try {
        // 1. Upload to Azure Blob Storage
        const fileBuffer = Buffer.from(file.content, 'base64')
        const { blobUrl, blobFilename } = await uploader.uploadFile(
          fileBuffer,
          file.name,
          file.type || 'application/pdf',
          session.user.id,
          evaluationId
        )

        // Create file record in database
        const fileResult = await pool.request()
          .input('sessionId', sql.NVarChar, evaluationId)
          .input('fileName', sql.NVarChar, file.name)
          .input('fileSize', sql.Int, file.size)
          .input('blobUrl', sql.NVarChar, blobUrl)
          .input('blobFilename', sql.NVarChar, blobFilename)
          .input('mimeType', sql.NVarChar, file.type || 'application/pdf')
          .query(`
            INSERT INTO evaluation_files (
              session_id, file_name, file_size, blob_url, blob_filename, 
              mime_type, status, extraction_status, ai_analysis_status
            )
            OUTPUT INSERTED.id
            VALUES (
              @sessionId, @fileName, @fileSize, @blobUrl, @blobFilename,
              @mimeType, 'uploaded', 'pending', 'pending'
            )
          `)
        
        const fileId = fileResult.recordset[0].id

        // 2. Extract text from PDF
        const extractedData = await extractor.extractText(fileBuffer)
        
        // Update extraction status
        await pool.request()
          .input('fileId', sql.NVarChar, fileId)
          .input('extractedText', sql.NText, extractedData.fullText.substring(0, 8000)) // Limit for storage
          .query(`
            UPDATE evaluation_files 
            SET extracted_text = @extractedText,
                extraction_status = 'completed'
            WHERE id = @fileId
          `)

        // 3. Analyze with AI
        const analysisResult = await analyzer.analyzeResume(
          session.user.id,
          extractedData.fullText,
          role
        )

        // 4. Store results
        await pool.request()
          .input('sessionId', sql.NVarChar, evaluationId)
          .input('fileId', sql.NVarChar, fileId)
          .input('userId', sql.NVarChar, session.user.id)
          .input('roleId', sql.NVarChar, evaluation.role_id)
          .input('candidateName', sql.NVarChar, file.name.replace('.pdf', ''))
          .input('overallScore', sql.Decimal(5, 2), analysisResult.overallScore)
          .input('skillMatches', sql.NText, JSON.stringify(analysisResult.skillMatches))
          .input('questionAnswers', sql.NText, JSON.stringify(analysisResult.questionAnswers))
          .input('recommendations', sql.NText, analysisResult.recommendations)
          .input('redFlags', sql.NText, JSON.stringify(analysisResult.redFlags))
          .input('strengths', sql.NText, JSON.stringify(analysisResult.strengths))
          .query(`
            INSERT INTO evaluation_results (
              session_id, file_id, user_id, role_id, candidate_name,
              overall_score, skill_matches, question_answers,
              recommendations, red_flags, ai_raw_response
            )
            VALUES (
              @sessionId, @fileId, @userId, @roleId, @candidateName,
              @overallScore, @skillMatches, @questionAnswers,
              @recommendations, @redFlags, @strengths
            )
          `)

        // Update file status
        await pool.request()
          .input('fileId', sql.NVarChar, fileId)
          .query(`
            UPDATE evaluation_files 
            SET status = 'completed', ai_analysis_status = 'completed'
            WHERE id = @fileId
          `)

        processedCount++
        results.push({
          fileId,
          fileName: file.name,
          score: analysisResult.overallScore,
          status: 'success'
        })

      } catch (error) {
        console.error(`Failed to process file ${file.name}:`, error)
        failedCount++
        results.push({
          fileName: file.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      // Update progress
      await pool.request()
        .input('evaluationId', sql.NVarChar, evaluationId)
        .input('processedFiles', sql.Int, processedCount)
        .input('failedFiles', sql.Int, failedCount)
        .query(`
          UPDATE evaluation_sessions 
          SET processed_files = @processedFiles,
              failed_files = @failedFiles,
              updated_at = GETUTCDATE()
          WHERE id = @evaluationId
        `)
    }

    // Calculate and update final stats
    const statsResult = await pool.request()
      .input('sessionId', sql.NVarChar, evaluationId)
      .query(`
        SELECT 
          AVG(overall_score) as avgScore,
          COUNT(CASE WHEN overall_score >= 70 THEN 1 END) as topCandidates
        FROM evaluation_results
        WHERE session_id = @sessionId
      `)

    const stats = statsResult.recordset[0]

    // Update evaluation as completed
    await pool.request()
      .input('evaluationId', sql.NVarChar, evaluationId)
      .input('status', sql.NVarChar, failedCount === files.length ? 'failed' : 'completed')
      .input('avgScore', sql.Decimal(5, 2), stats.avgScore || 0)
      .input('topCandidates', sql.Int, stats.topCandidates || 0)
      .query(`
        UPDATE evaluation_sessions 
        SET status = @status,
            average_score = @avgScore,
            top_candidates = @topCandidates,
            completed_at = GETUTCDATE(),
            updated_at = GETUTCDATE()
        WHERE id = @evaluationId
      `)

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} files successfully`,
      data: {
        evaluationId,
        processed: processedCount,
        failed: failedCount,
        results,
        averageScore: stats.avgScore || 0,
        topCandidates: stats.topCandidates || 0
      }
    })

  } catch (error) {
    console.error('Evaluation processing error:', error)
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