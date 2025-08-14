import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import sql from 'mssql'
import { getDbConnection } from '@/lib/db'
import { smartRouter } from '@/lib/evaluation/smart-router'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let pool: sql.ConnectionPool | null = null
  
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      )
    }

    const evaluationId = params.id
    pool = await getDbConnection()

    // Get evaluation session with progress details from evaluation_sessions
    const evaluationResult = await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .input('userId', sql.UniqueIdentifier, session.user.id)
      .query(`
        SELECT 
          es.id,
          es.status,
          es.total_files,
          es.processed_files as files_processed,
          es.failed_files as files_failed,
          es.created_at,
          es.updated_at,
          r.title as role_title,
          DATEDIFF(SECOND, es.started_at, GETDATE()) as processing_seconds,
          (
            SELECT COUNT(*) 
            FROM evaluation_files ef 
            WHERE ef.evaluation_id = es.id AND ef.status = 'processing'
          ) as files_processing,
          (
            SELECT COUNT(*) 
            FROM evaluation_files ef 
            WHERE ef.evaluation_id = es.id AND ef.status = 'pending'
          ) as files_pending,
          es.average_score
        FROM evaluation_sessions es
        JOIN roles r ON es.role_id = r.id
        WHERE es.id = @evaluationId AND es.user_id = @userId
      `)

    if (evaluationResult.recordset.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Evaluation not found' },
        { status: 404 }
      )
    }

    const evaluation = evaluationResult.recordset[0]

    // Get file-level progress with corrected table structure
    const filesResult = await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query(`
        SELECT 
          ef.id,
          ef.file_name as filename,
          ef.status,
          ef.created_at,
          ef.processed_at as updated_at,
          ef.overall_score as score,
          DATEDIFF(MILLISECOND, ef.created_at, ef.processed_at) as processing_time_ms
        FROM evaluation_files ef
        WHERE ef.evaluation_id = @evaluationId
        ORDER BY ef.created_at ASC
      `)

    const files = filesResult.recordset

    // Calculate progress percentage
    const totalFiles = evaluation.total_files || files.length
    const processedFiles = evaluation.files_processed || 0
    const failedFiles = evaluation.files_failed || 0
    const completedFiles = processedFiles + failedFiles
    const progressPercentage = totalFiles > 0 
      ? Math.round((completedFiles / totalFiles) * 100)
      : 0

    // Estimate remaining time
    let estimatedTimeRemaining = null
    if (evaluation.status === 'processing' && processedFiles > 0) {
      const avgTimePerFile = evaluation.processing_seconds / processedFiles
      const remainingFiles = totalFiles - completedFiles
      estimatedTimeRemaining = Math.ceil(avgTimePerFile * remainingFiles)
    }

    // Get system metrics for additional context
    const metrics = smartRouter.getMetrics()

    // Prepare response
    const response = {
      success: true,
      data: {
        evaluation: {
          id: evaluation.id,
          status: evaluation.status,
          roleTitle: evaluation.role_title,
          createdAt: evaluation.created_at,
          updatedAt: evaluation.updated_at
        },
        progress: {
          totalFiles,
          processedFiles,
          failedFiles,
          processingFiles: evaluation.files_processing || 0,
          pendingFiles: evaluation.files_pending || 0,
          progressPercentage,
          averageScore: evaluation.average_score ? Math.round(evaluation.average_score) : null,
          processingTimeSeconds: evaluation.processing_seconds,
          estimatedTimeRemaining
        },
        files: files.map((file: any) => ({
          id: file.id,
          filename: file.filename,
          status: file.status,
          score: file.score,
          processingTimeMs: file.processing_time_ms,
          createdAt: file.created_at,
          updatedAt: file.updated_at
        })),
        systemStatus: {
          azureHealthy: metrics.azureHealthy,
          lastHealthCheck: metrics.lastHealthCheck,
          processingMode: determineCurrentMode(totalFiles)
        }
      }
    }

    // Add completion message if done
    if (evaluation.status === 'completed') {
      response.data.progress.completionMessage = `Successfully processed ${processedFiles} files with an average score of ${Math.round(evaluation.average_score || 0)}%`
    } else if (evaluation.status === 'failed') {
      response.data.progress.completionMessage = `Processing failed. ${processedFiles} files completed before failure.`
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching evaluation progress:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch progress',
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

/**
 * Determine the processing mode based on file count
 */
function determineCurrentMode(fileCount: number): string {
  if (fileCount <= 10) return 'direct'
  if (fileCount <= 50) return 'hybrid'
  return 'async'
}