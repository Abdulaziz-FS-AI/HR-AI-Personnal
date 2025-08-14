import { hyperbolicService } from './ai/hyperbolic-service'
import { getServiceBusService, type AIAnalysisMessage } from './azure/service-bus'
import { updateFileStatus, getFilesByStatus } from './db-files'
import { getRoleById } from './db-roles'
import { 
  createBatchSession, 
  updateBatchSession, 
  getBatchSession, 
  storeAnalysisResult,
  type BatchProcessingSession,
  type AnalysisResult 
} from './db-batch'

// Remove duplicate interface - using the one from db-batch

interface FileForProcessing {
  id: string
  fileName: string
  blobName: string
  extractedText: string
  userId: string
}

export class BatchProcessor {
  private static readonly MAX_BATCH_SIZE = 50
  private static readonly MAX_CONCURRENT_BATCHES = 1 // Process one batch at a time

  /**
   * Start batch processing for a role
   */
  static async startBatchProcessing(roleId: string, userId: string): Promise<string> {
    console.log(`Starting batch processing for role ${roleId}, user ${userId}`)

    // Get all files ready for processing
    const pendingFiles = await this.getFilesReadyForProcessing(userId, roleId)
    
    if (pendingFiles.length === 0) {
      throw new Error('No files ready for processing')
    }

    // Get role details
    const role = await getRoleById(roleId)
    if (!role) {
      throw new Error('Role not found')
    }

    const sessionId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Create batch processing session
    const session: BatchProcessingSession = {
      sessionId,
      userId,
      roleId,
      totalFiles: pendingFiles.length,
      processedFiles: 0,
      failedFiles: 0,
      startedAt: new Date(),
      status: 'pending'
    }

    // Store session info in database
    const sessionStored = await createBatchSession(session)
    if (!sessionStored) {
      throw new Error('Failed to create batch session in database')
    }

    // Split files into batches of 50
    const batches = this.splitIntoBatches(pendingFiles, this.MAX_BATCH_SIZE)
    
    console.log(`Split ${pendingFiles.length} files into ${batches.length} batches`)

    // Process batches sequentially
    this.processBatchesSequentially(session, batches, role)
      .catch(async (error) => {
        console.error('Batch processing failed:', error)
        await updateBatchSession(sessionId, { 
          status: 'failed',
          completedAt: new Date()
        })
      })

    return sessionId
  }

  /**
   * Process batches sequentially to respect rate limits
   */
  private static async processBatchesSequentially(
    session: BatchProcessingSession,
    batches: FileForProcessing[][],
    role: any
  ): Promise<void> {
    console.log(`Processing ${batches.length} batches for session ${session.sessionId}`)

    await updateBatchSession(session.sessionId, { status: 'processing' })

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} files`)

      try {
        // Update files to processing status
        await Promise.all(
          batch.map(file => 
            updateFileStatus(file.id, { processingStatus: 'analyzing' })
          )
        )

        // Prepare requests for Hyperbolic
        const requests = batch.map(file => ({
          fileId: file.id,
          roleId: session.roleId,
          userId: session.userId,
          extractedText: file.extractedText,
          roleSkills: role.skills || [],
          roleQuestions: role.questions || []
        }))

        // Process batch with Hyperbolic
        const results = await hyperbolicService.processBatch(requests)

        // Store results in database
        const storeResults = await Promise.allSettled(
          results.map(result => storeAnalysisResult({
            fileId: result.fileId,
            sessionId: session.sessionId,
            roleId: session.roleId,
            userId: session.userId,
            overallScore: result.overallScore,
            skillsAnalysis: result.skillsAnalysis,
            questionsAnalysis: result.questionsAnalysis,
            summary: result.summary,
            recommendations: result.recommendations,
            redFlags: result.redFlags,
            totalTokensUsed: result.totalTokensUsed
          }))
        )

        // Count successful storage operations
        const storedCount = storeResults.filter(r => r.status === 'fulfilled').length
        const storageFailedCount = results.length - storedCount

        // Update session progress
        const currentSession = await getBatchSession(session.sessionId)
        if (currentSession) {
          await updateBatchSession(session.sessionId, {
            processedFiles: currentSession.processedFiles + storedCount,
            failedFiles: currentSession.failedFiles + storageFailedCount
          })
        }

        console.log(`Batch ${i + 1} completed: ${storedCount} stored successfully, ${storageFailedCount} storage failed`)

        // Add delay between batches to be extra safe with rate limits
        if (i < batches.length - 1) {
          console.log('Waiting 2 seconds before next batch...')
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

      } catch (error) {
        console.error(`Batch ${i + 1} failed:`, error)
        
        // Mark all files in this batch as failed
        await Promise.all(
          batch.map(file => 
            updateFileStatus(file.id, { processingStatus: 'failed' })
          )
        )

        const currentSession = await getBatchSession(session.sessionId)
        if (currentSession) {
          await updateBatchSession(session.sessionId, {
            failedFiles: currentSession.failedFiles + batch.length
          })
        }
      }
    }

    // Mark session as completed
    await updateBatchSession(session.sessionId, {
      status: 'completed',
      completedAt: new Date()
    })

    console.log(`Batch processing completed for session ${session.sessionId}`)
  }

  /**
   * Get files ready for processing
   */
  private static async getFilesReadyForProcessing(
    userId: string, 
    roleId: string
  ): Promise<FileForProcessing[]> {
    // Get files that have been uploaded and have extracted text
    const files = await getFilesByStatus('completed') // Files with extracted text
    
    return files
      .filter(file => 
        file.userId === userId && 
        file.extractedText && 
        file.extractedText.length > 50
      )
      .map(file => ({
        id: file.id,
        fileName: file.fileName,
        blobName: file.blobName || '',
        extractedText: file.extractedText,
        userId: file.userId
      }))
  }

  /**
   * Split files into batches
   */
  private static splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * Get batch processing status
   */
  static async getBatchStatus(sessionId: string): Promise<BatchProcessingSession | null> {
    try {
      return await getBatchSession(sessionId)
    } catch (error) {
      console.error('Error getting batch status:', error)
      return null
    }
  }

  /**
   * Cancel batch processing
   */
  static async cancelBatchProcessing(sessionId: string): Promise<boolean> {
    try {
      const success = await updateBatchSession(sessionId, {
        status: 'failed',
        completedAt: new Date()
      })
      
      if (success) {
        console.log(`Batch processing cancelled for session: ${sessionId}`)
      }
      
      return success
    } catch (error) {
      console.error('Error cancelling batch processing:', error)
      return false
    }
  }
}