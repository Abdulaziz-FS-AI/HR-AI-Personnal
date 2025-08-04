import {
  app,
  InvocationContext
} from '@azure/functions'
import { ServiceBusReceivedMessage } from '../types/azure-types'
import {
  updateFileStatus,
  getFileById,
  getRoleWithDetails,
  saveAnalysisResults,
  checkSessionCompletion
} from '../shared/db-utils'
import { analyzeResumeWithAI, validateAnalysisResult } from '../shared/ai-utils'
import { queueSessionCompletion } from '../shared/service-bus-utils'

/**
 * AI Analyzer Function - Triggered by Service Bus Queue
 */
async function aiAnalyzer(
  message: ServiceBusReceivedMessage,
  context: InvocationContext
): Promise<void> {
  const startTime = Date.now()
  let fileId: string | undefined

  try {
    context.log('AI Analyzer started', { messageId: message.messageId })

    // Parse message body
    const {
      fileId: msgFileId,
      userId,
      roleId,
      sessionId,
      extractedText,
    } = message.body

    fileId = msgFileId
    context.log('Analyzing file:', { fileId, roleId, sessionId })

    // Get file details from database
    const fileRecord = await getFileById(fileId)
    if (!fileRecord) {
      throw new Error(`File record not found: ${fileId}`)
    }

    // Get role details with skills and questions
    const role = await getRoleWithDetails(roleId)
    if (!role) {
      throw new Error(`Role not found: ${roleId}`)
    }

    context.log('Role details loaded:', {
      roleTitle: role.title,
      skillsCount: role.skills?.length || 0,
      questionsCount: role.questions?.length || 0
    })

    // Parse extracted text data
    let resumeData
    try {
      resumeData = JSON.parse(extractedText)
    } catch (error) {
      // Fallback to treating as plain text
      resumeData = { text: extractedText }
    }

    // Prepare AI analysis request
    const aiRequest = {
      resumeText: resumeData.text || extractedText,
      role: {
        title: role.title,
        department: role.department,
        description: role.description,
        skills: role.skills || [],
        questions: role.questions || []
      }
    }

    context.log('Sending request to AI service')
    
    // Call AI analysis service
    const analysis = await analyzeResumeWithAI(aiRequest)

    // Validate analysis result
    if (!validateAnalysisResult(analysis)) {
      throw new Error('Invalid analysis result structure')
    }

    context.log('AI analysis completed:', {
      overallScore: analysis.overallScore,
      recommendation: analysis.recommendation,
      processingTime: analysis.processingTimeSeconds
    })

    // Save analysis results to database
    await saveAnalysisResults(fileId, roleId, sessionId, analysis)

    // Update file status to analyzed
    await updateFileStatus(fileId, 'analyzed')

    // Queue session completion check
    await queueSessionCompletion({
      sessionId,
      userId,
      roleId
    })

    const totalProcessingTime = Date.now() - startTime
    context.log('AI analysis completed successfully', {
      fileId,
      totalProcessingTimeMs: totalProcessingTime,
      aiProcessingTimeSeconds: analysis.processingTimeSeconds,
      overallScore: analysis.overallScore,
      recommendation: analysis.recommendation,
      aiCost: analysis.aiCost
    })

  } catch (error) {
    context.error('AI analysis failed:', error)

    if (fileId) {
      await updateFileStatus(
        fileId,
        'failed',
        undefined,
        error instanceof Error ? error.message : 'AI analysis failed'
      )
    }

    // Check retry count
    const retryCount = (message.applicationProperties?.retryCount as number) || 0
    if (retryCount < 2) { // Fewer retries for AI analysis due to cost
      // Allow function to throw error for automatic retry
      throw error
    } else {
      // Max retries reached, log and complete
      context.error('Max retries reached for AI analysis:', fileId)
      
      // Still queue session completion check even if this file failed
      if (message.body.sessionId && message.body.userId && message.body.roleId) {
        await queueSessionCompletion({
          sessionId: message.body.sessionId,
          userId: message.body.userId,
          roleId: message.body.roleId
        })
      }
    }
  }
}

/**
 * Session Completion Checker Function - Triggered by Service Bus Queue
 */
async function sessionCompletionChecker(
  message: ServiceBusReceivedMessage,
  context: InvocationContext
): Promise<void> {
  try {
    context.log('Session completion checker started', { messageId: message.messageId })

    const { sessionId, userId, roleId } = message.body

    context.log('Checking session completion:', { sessionId, userId, roleId })

    // Check and update session completion status
    await checkSessionCompletion(sessionId)

    context.log('Session completion check completed:', { sessionId })

  } catch (error) {
    context.error('Session completion check failed:', error)
    // Don't throw error here as this is not critical for retry
  }
}

// Register the AI analyzer function
app.serviceBusQueue('aiAnalyzer', {
  connection: 'AZURE_SERVICE_BUS_CONNECTION_STRING',
  queueName: 'ai-analysis',
  handler: aiAnalyzer
})

// Register the session completion checker
app.serviceBusQueue('sessionCompletionChecker', {
  connection: 'AZURE_SERVICE_BUS_CONNECTION_STRING',
  queueName: 'session-completion',
  handler: sessionCompletionChecker
})

export { aiAnalyzer, sessionCompletionChecker }