import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { smartRouter, ProcessingMode } from '@/lib/evaluation/smart-router'
import sql from 'mssql'
import { getDbConnection } from '@/lib/db'

// Dynamic timeout based on processing mode
export const maxDuration = 300 // 5 minutes max (Vercel Hobby limit)

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

    const { evaluationId, files, priority = 'normal' } = await request.json()
    
    if (!evaluationId || !files || files.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid request data' },
        { status: 400 }
      )
    }

    pool = await getDbConnection()
    
    // Verify evaluation belongs to user and get role info
    const evalCheck = await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .input('userId', sql.NVarChar, session.user.id)
      .query(`
        SELECT es.*, r.title as roleTitle, r.id as roleId
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

    // Update evaluation status to processing
    await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .input('status', sql.NVarChar, 'processing')
      .query(`
        UPDATE evaluation_sessions 
        SET status = @status, updated_at = GETDATE()
        WHERE id = @evaluationId
      `)

    console.log(`📋 Processing evaluation ${evaluationId} with ${files.length} files`)

    // Prepare files for smart router
    const routerFiles = files.map((file: any) => ({
      id: file.id || `file-${Date.now()}-${Math.random()}`,
      content: file.content,
      filename: file.filename
    }))

    // Use smart router to process evaluation
    const result = await smartRouter.processEvaluation({
      evaluationId,
      roleId: evaluation.roleId,
      userId: session.user.id,
      files: routerFiles,
      priority: priority as 'low' | 'normal' | 'high' | 'critical',
      metadata: {
        roleTitle: evaluation.roleTitle,
        sessionStart: new Date().toISOString()
      }
    })

    // Update evaluation based on result
    const finalStatus = result.success 
      ? 'completed' 
      : result.mode === ProcessingMode.ASYNC 
        ? 'processing' 
        : 'completed_with_errors'

    await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .input('status', sql.NVarChar, finalStatus)
      .input('processedCount', sql.Int, result.processedCount)
      .input('failedCount', sql.Int, result.failedCount)
      .query(`
        UPDATE evaluation_sessions 
        SET status = @status, 
            files_processed = @processedCount,
            files_failed = @failedCount,
            updated_at = GETDATE()
        WHERE id = @evaluationId
      `)

    // Prepare response based on processing mode
    let responseMessage = ''
    let responseData: any = {
      evaluationId,
      mode: result.mode,
      processedCount: result.processedCount,
      failedCount: result.failedCount
    }

    switch (result.mode) {
      case ProcessingMode.DIRECT:
        responseMessage = `Processed ${result.processedCount} files successfully`
        responseData.complete = true
        break
      
      case ProcessingMode.HYBRID:
        responseMessage = `Processing started. ${result.processedCount} files completed, remaining files queued.`
        responseData.estimatedCompletion = result.estimatedCompletionTime
        responseData.complete = false
        break
      
      case ProcessingMode.ASYNC:
        responseMessage = `All ${files.length} files queued for processing. You'll be notified when complete.`
        responseData.estimatedCompletion = result.estimatedCompletionTime
        responseData.queueMessageId = result.queueMessageId
        responseData.complete = false
        break
      
      case ProcessingMode.EMERGENCY:
        responseMessage = `Emergency processing completed. ${result.processedCount} of ${files.length} files processed.`
        responseData.complete = true
        responseData.degradedMode = true
        break
    }

    // Add errors if any
    if (result.errors && result.errors.length > 0) {
      responseData.errors = result.errors
    }

    // Get current metrics for monitoring
    const metrics = smartRouter.getMetrics()
    console.log('📊 Processing Metrics:', metrics)

    return NextResponse.json({
      success: result.failedCount === 0 || result.mode === ProcessingMode.ASYNC,
      message: responseMessage,
      data: responseData
    })

  } catch (error) {
    console.error('Error processing evaluation:', error)
    
    // Try to update evaluation status to failed
    if (pool) {
      try {
        const { evaluationId } = await request.json()
        await pool.request()
          .input('evaluationId', sql.UniqueIdentifier, evaluationId)
          .input('status', sql.NVarChar, 'failed')
          .query(`
            UPDATE evaluation_sessions 
            SET status = @status, updated_at = GETDATE()
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