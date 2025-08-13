import {
  app,
  InvocationContext,
  ServiceBusQueueTrigger
} from '@azure/functions'
import { downloadBlobAsBuffer } from '../shared/blob-utils'
import { 
  getEvaluationSession,
  getRoleDetails,
  createEvaluationResult,
  updateEvaluationFile,
  updateEvaluationSession
} from '../shared/enhanced-db-utils'
import { extractTextFromPDF } from '../shared/pdf-utils'
import { analyzeResumeWithAI } from '../shared/ai-utils'
import { notifyProcessingComplete, notifyProcessingFailed } from '../shared/notification-utils'

interface EvaluationMessage {
  evaluationId: string
  roleId: string
  userId: string
  files: Array<{
    id: string
    filename: string
    size: number
  }>
  priority: 'low' | 'normal' | 'high' | 'critical'
  metadata?: Record<string, any>
  timestamp: string
}

interface ProcessingResult {
  fileId: string
  success: boolean
  score?: number
  analysis?: any
  error?: string
}

/**
 * Evaluation Processor Function - Triggered by Service Bus Queue
 * Processes evaluation requests from the smart router
 */
async function evaluationProcessor(
  message: ServiceBusQueueTrigger,
  context: InvocationContext
): Promise<void> {
  const startTime = Date.now()
  let evaluationId: string | undefined
  let userId: string | undefined
  
  try {
    context.log('🚀 Evaluation processor started', {
      messageId: message.messageId,
      sessionId: message.sessionId,
      deliveryCount: message.deliveryCount
    })

    // Parse message body
    const evaluationData = message.body as EvaluationMessage
    evaluationId = evaluationData.evaluationId
    userId = evaluationData.userId
    
    context.log(`📋 Processing evaluation ${evaluationId} with ${evaluationData.files.length} files`)

    // Get evaluation session details
    const session = await getEvaluationSession(evaluationId)
    if (!session) {
      throw new Error(`Evaluation session not found: ${evaluationId}`)
    }

    // Get role details (skills, questions, requirements)
    const roleDetails = await getRoleDetails(evaluationData.roleId)
    if (!roleDetails) {
      throw new Error(`Role not found: ${evaluationData.roleId}`)
    }

    context.log(`🎯 Role: ${roleDetails.title}, Skills: ${roleDetails.skills.length}, Questions: ${roleDetails.questions.length}`)

    // Process files based on priority
    const results = await processFiles(
      evaluationData,
      roleDetails,
      context,
      evaluationData.priority
    )

    // Calculate statistics
    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length
    const avgScore = results
      .filter(r => r.score !== undefined)
      .reduce((acc, r) => acc + (r.score || 0), 0) / successCount || 0

    // Update evaluation session
    await updateEvaluationSession(evaluationId, {
      status: failureCount === 0 ? 'completed' : 'completed_with_errors',
      filesProcessed: successCount,
      filesFailed: failureCount,
      avgScore: Math.round(avgScore),
      completedAt: new Date()
    })

    // Send notification
    await notifyProcessingComplete(
      evaluationId,
      userId,
      session.userEmail || '',
      {
        totalFiles: evaluationData.files.length,
        processed: successCount,
        failed: failureCount,
        avgScore: Math.round(avgScore),
        roleTitle: roleDetails.title
      }
    )

    const processingTime = Date.now() - startTime
    context.log(`✅ Evaluation ${evaluationId} completed in ${processingTime}ms`, {
      successCount,
      failureCount,
      avgScore
    })

  } catch (error) {
    context.error('❌ Evaluation processing failed:', error)

    // Update session as failed
    if (evaluationId) {
      await updateEvaluationSession(evaluationId, {
        status: 'failed',
        completedAt: new Date()
      })
    }

    // Send failure notification
    if (evaluationId && userId) {
      await notifyProcessingFailed(
        evaluationId,
        userId,
        '', // Email will be fetched from session
        message.body.files?.length || 0,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }

    // Re-throw for Service Bus retry logic (if delivery count < max)
    if (message.deliveryCount < 3) {
      throw error
    } else {
      context.error('Max retries reached, message will be dead-lettered')
    }
  }
}

/**
 * Process files with priority-based concurrency
 */
async function processFiles(
  evaluationData: EvaluationMessage,
  roleDetails: any,
  context: InvocationContext,
  priority: string
): Promise<ProcessingResult[]> {
  // Determine concurrency based on priority
  const concurrency = priority === 'critical' ? 10 : 
                     priority === 'high' ? 7 : 
                     priority === 'normal' ? 5 : 3

  const results: ProcessingResult[] = []
  const chunks = chunkArray(evaluationData.files, concurrency)

  for (const [chunkIndex, chunk] of chunks.entries()) {
    context.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} files)`)

    const chunkPromises = chunk.map(file => 
      processFile(file, evaluationData.evaluationId, roleDetails, context)
    )

    const chunkResults = await Promise.allSettled(chunkPromises)
    
    chunkResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        results.push({
          fileId: chunk[index].id,
          success: false,
          error: result.reason?.message || 'Processing failed'
        })
      }
    })

    // Add delay between chunks for rate limiting
    if (chunkIndex < chunks.length - 1) {
      await sleep(1000) // 1 second delay
    }
  }

  return results
}

/**
 * Process individual file
 */
async function processFile(
  file: { id: string; filename: string; size: number },
  evaluationId: string,
  roleDetails: any,
  context: InvocationContext
): Promise<ProcessingResult> {
  const fileStartTime = Date.now()
  
  try {
    context.log(`📄 Processing file: ${file.filename}`)

    // Update file status to processing
    await updateEvaluationFile(file.id, {
      status: 'processing',
      startedAt: new Date()
    })

    // Download file from blob storage
    const blobName = `evaluations/${evaluationId}/${file.filename}`
    const fileBuffer = await downloadBlobAsBuffer('resumes', blobName)

    // Extract text from PDF
    const extractedText = await extractTextFromPDF(fileBuffer)
    
    // Analyze with AI
    const analysis = await analyzeResumeWithAI({
      text: extractedText.text,
      roleId: roleDetails.id,
      roleTitle: roleDetails.title,
      skills: roleDetails.skills,
      questions: roleDetails.questions,
      requirements: roleDetails.requirements
    })

    // Save results
    await createEvaluationResult({
      evaluationId,
      fileId: file.id,
      filename: file.filename,
      overallScore: analysis.overallScore,
      skillsAnalysis: analysis.skillsAnalysis,
      questionsAnalysis: analysis.questionsAnalysis,
      recommendations: analysis.recommendations,
      redFlags: analysis.redFlags,
      summary: analysis.summary,
      extractedText: extractedText.text,
      processingTimeMs: Date.now() - fileStartTime
    })

    // Update file status to completed
    await updateEvaluationFile(file.id, {
      status: 'completed',
      score: analysis.overallScore,
      completedAt: new Date()
    })

    context.log(`✅ File ${file.filename} processed successfully. Score: ${analysis.overallScore}`)

    return {
      fileId: file.id,
      success: true,
      score: analysis.overallScore,
      analysis: analysis
    }

  } catch (error) {
    context.error(`❌ Failed to process file ${file.filename}:`, error)

    // Update file status to failed
    await updateEvaluationFile(file.id, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      completedAt: new Date()
    })

    return {
      fileId: file.id,
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed'
    }
  }
}

/**
 * Utility: Chunk array into smaller arrays
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Utility: Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Register the Service Bus Queue trigger
app.serviceBusQueue('evaluationProcessor', {
  connection: 'AZURE_SERVICE_BUS_CONNECTION_STRING',
  queueName: 'evaluation-queue',
  handler: evaluationProcessor
})

export { evaluationProcessor }