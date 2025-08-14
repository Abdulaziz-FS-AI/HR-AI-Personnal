import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
  Timer
} from '@azure/functions'
import { 
  getBatchSession, 
  getBatchSessionFiles, 
  updateBatchProgress,
  updateFileStatus 
} from '../shared/enhanced-db-utils'
import { queueForAIAnalysis } from '../shared/service-bus-utils'
import { notifyProcessingComplete, notifyProcessingFailed } from '../shared/notification-utils'

interface BulkProcessingStats {
  totalFiles: number
  processed: number
  failed: number
  avgScore?: number
  roleTitle?: string
}

/**
 * Bulk Processor Function - Triggered by Timer
 * Processes pending batch sessions every 30 seconds
 */
async function bulkProcessor(myTimer: Timer, context: InvocationContext): Promise<void> {
  const startTime = Date.now()
  
  try {
    context.log('Bulk processor started at', new Date().toISOString())

    // Get pending batch sessions
    const pendingSessions = await getPendingBatchSessions()
    
    if (pendingSessions.length === 0) {
      context.log('No pending bulk processing sessions found')
      return
    }

    context.log(`Found ${pendingSessions.length} pending batch sessions`)

    // Process each session
    for (const session of pendingSessions) {
      try {
        await processBatchSession(session.id, context)
      } catch (error) {
        context.error(`Error processing batch session ${session.id}:`, error)
        
        // Mark session as failed and notify user
        await updateBatchProgress(session.id, {
          status: 'failed',
          completedAt: new Date()
        })

        await notifyProcessingFailed(
          session.id,
          session.userId,
          session.notificationEmail,
          session.totalFiles,
          error instanceof Error ? error.message : 'Unknown error'
        )
      }
    }

    const processingTime = Date.now() - startTime
    context.log(`Bulk processor completed in ${processingTime}ms`)

  } catch (error) {
    context.error('Bulk processor failed:', error)
    throw error
  }
}

/**
 * Process a single batch session
 */
async function processBatchSession(sessionId: string, context: InvocationContext): Promise<void> {
  context.log(`Processing batch session: ${sessionId}`)

  // Get session details
  const session = await getBatchSession(sessionId)
  if (!session) {
    throw new Error(`Batch session not found: ${sessionId}`)
  }

  // Update session status to processing
  await updateBatchProgress(sessionId, {
    status: 'processing'
  })

  // Get all files for this session
  const files = await getBatchSessionFiles(sessionId)
  if (files.length === 0) {
    throw new Error(`No files found for session: ${sessionId}`)
  }

  context.log(`Found ${files.length} files to process for session ${sessionId}`)

  let processedCount = 0
  let failedCount = 0
  const scores: number[] = []

  // Process files in batches to respect rate limits
  const BATCH_SIZE = 10 // Process 10 files at a time
  const batches = chunkArray(files, BATCH_SIZE)

  for (const [batchIndex, batch] of batches.entries()) {
    context.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} files)`)

    // Process files in parallel within the batch
    const batchPromises = batch.map(async (file) => {
      try {
        // Check if file is ready for processing
        if (file.uploadStatus !== 'completed' || file.processingStatus !== 'not_started') {
          context.log(`Skipping file ${file.id} - not ready (upload: ${file.uploadStatus}, processing: ${file.processingStatus})`)
          return { success: false, fileId: file.id, error: 'File not ready' }
        }

        // Update file status to processing
        await updateFileStatus(file.id, 'processing')

        // Queue for AI analysis if role is specified
        if (session.roleId) {
          await queueForAIAnalysis({
            fileId: file.id,
            userId: session.userId,
            roleId: session.roleId,
            sessionId: sessionId,
            extractedText: file.extractedText || '',
            priority: session.priority === 'high' ? 1 : session.priority === 'low' ? 10 : 5,
            retryCount: 0
          })
        } else {
          // Mark as analyzed if no role specified
          await updateFileStatus(file.id, 'analyzed')
        }

        return { success: true, fileId: file.id }

      } catch (error) {
        context.error(`Error processing file ${file.id}:`, error)
        
        // Mark file as failed
        await updateFileStatus(
          file.id,
          'failed',
          undefined,
          error instanceof Error ? error.message : 'Unknown error'
        )

        return { success: false, fileId: file.id, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })

    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises)
    
    // Count successes and failures
    for (const result of batchResults) {
      if (result.success) {
        processedCount++
      } else {
        failedCount++
        context.log(`File ${result.fileId} failed: ${result.error}`)
      }
    }

    // Update progress
    await updateBatchProgress(sessionId, {
      totalProcessed: processedCount,
      totalFailed: failedCount
    })

    context.log(`Batch ${batchIndex + 1} completed. Total processed: ${processedCount}, failed: ${failedCount}`)

    // Add delay between batches to respect rate limits
    if (batchIndex < batches.length - 1) {
      await sleep(2000) // 2 second delay between batches
    }
  }

  // Determine final status
  const finalStatus = failedCount === 0 
    ? 'completed' 
    : processedCount > 0 
      ? 'completed_with_errors' 
      : 'failed'

  // Update session status
  await updateBatchProgress(sessionId, {
    status: finalStatus,
    completedAt: new Date()
  })

  // Calculate average score if available
  const avgScore = scores.length > 0 
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : undefined

  // Get role title for notification
  const roleTitle = session.roleId ? await getRoleTitle(session.roleId) : undefined

  // Send completion notification
  const stats: BulkProcessingStats = {
    totalFiles: files.length,
    processed: processedCount,
    failed: failedCount,
    avgScore,
    roleTitle
  }

  if (finalStatus === 'failed') {
    await notifyProcessingFailed(
      sessionId,
      session.userId,
      session.notificationEmail,
      files.length,
      'All files failed to process'
    )
  } else {
    await notifyProcessingComplete(
      sessionId,
      session.userId,
      session.notificationEmail,
      stats
    )
  }

  context.log(`Batch session ${sessionId} completed with status: ${finalStatus}`)
}

/**
 * Get pending batch sessions from database
 */
async function getPendingBatchSessions(): Promise<Array<{
  id: string
  userId: string
  roleId: string | null
  notificationEmail: string
  totalFiles: number
  priority: 'low' | 'normal' | 'high'
}>> {
  // This would be implemented in your enhanced-db-utils
  // For now, return mock data
  return []
}

/**
 * Get role title for notifications
 */
async function getRoleTitle(roleId: string): Promise<string | undefined> {
  // This would be implemented in your enhanced-db-utils
  return undefined
}

/**
 * Utility function to chunk array into smaller arrays
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

/**
 * Utility function to sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Register the timer function - runs every 30 seconds
app.timer('bulkProcessor', {
  schedule: '0 */30 * * * *', // Every 30 seconds
  handler: bulkProcessor
})

// Also register as HTTP function for manual triggering
app.http('bulkProcessorTrigger', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      // Create a mock timer object for manual trigger
      const mockTimer = {
        isPastDue: false,
        scheduleStatus: {
          last: new Date(),
          next: new Date(Date.now() + 30000),
          lastUpdated: new Date()
        }
      } as Timer

      await bulkProcessor(mockTimer, context)

      return {
        status: 200,
        jsonBody: {
          success: true,
          message: 'Bulk processor triggered successfully'
        }
      }
    } catch (error) {
      return {
        status: 500,
        jsonBody: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }
})

export { bulkProcessor }