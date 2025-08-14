import {
  app,
  InvocationContext,
} from '@azure/functions'
import { downloadBlobAsBuffer, uploadBlob } from '../shared/blob-utils'
import { 
  getDbConnection,
  updateEvaluationStatus,
  saveEvaluationResult
} from '../shared/enhanced-db-utils'
import pdf from 'pdf-parse'
import axios from 'axios'

interface EvaluationQueueMessage {
  evaluationId: string
  roleId: string
  userId: string
  userEmail: string
  roleTitle: string
  files: Array<{
    id: string
    filename: string
    content: string // Base64
  }>
  timestamp: string
}

/**
 * Evaluation Queue Processor - Triggered by Service Bus
 * Processes evaluation requests from Vercel
 */
async function evaluationQueueProcessor(
  message: any, // Service Bus message
  context: InvocationContext
): Promise<void> {
  const startTime = Date.now()
  let evaluationId: string | undefined
  
  try {
    context.log('🚀 Evaluation queue processor started')
    
    // Parse message
    const data = message as EvaluationQueueMessage
    evaluationId = data.evaluationId
    
    context.log(`📋 Processing evaluation ${evaluationId} with ${data.files.length} files`)

    // Get database connection
    const pool = await getDbConnection()
    
    // Load role skills and questions
    const skillsResult = await pool.request()
      .input('roleId', data.roleId)
      .query(`
        SELECT skill_name, weight, is_required
        FROM role_skills
        WHERE role_id = @roleId
        ORDER BY weight DESC
      `)

    const questionsResult = await pool.request()
      .input('roleId', data.roleId)
      .query(`
        SELECT question_text, weight
        FROM role_questions
        WHERE role_id = @roleId
        ORDER BY weight DESC
      `)

    const skills = skillsResult.recordset
    const questions = questionsResult.recordset

    let processedCount = 0
    let failedCount = 0
    const results: any[] = []

    // Process each file
    for (const file of data.files) {
      try {
        context.log(`📄 Processing file: ${file.filename}`)

        // Decode base64 content
        const fileBuffer = Buffer.from(
          file.content.includes(',') 
            ? file.content.split(',')[1] 
            : file.content, 
          'base64'
        )

        // Upload to blob storage
        const blobName = `evaluations/${evaluationId}/${file.filename}`
        await uploadBlob('resumes', blobName, fileBuffer)

        // Extract text from PDF
        const pdfData = await pdf(fileBuffer)
        const extractedText = pdfData.text

        if (!extractedText || extractedText.length < 100) {
          throw new Error('Failed to extract meaningful text from PDF')
        }

        // Analyze with AI (Hyperbolic)
        const analysis = await analyzeWithAI(
          extractedText,
          data.roleTitle,
          skills,
          questions,
          context
        )

        // Save result to database
        await saveEvaluationResult(pool, {
          evaluationId: data.evaluationId,
          fileId: file.id,
          filename: file.filename,
          overallScore: analysis.overallScore,
          skillsAnalysis: JSON.stringify(analysis.skillsAnalysis),
          questionsAnalysis: JSON.stringify(analysis.questionsAnalysis),
          recommendations: JSON.stringify(analysis.recommendations),
          redFlags: JSON.stringify(analysis.redFlags),
          extractedText: extractedText
        })

        processedCount++
        results.push({
          filename: file.filename,
          score: analysis.overallScore,
          success: true
        })

        context.log(`✅ File ${file.filename} processed. Score: ${analysis.overallScore}`)

      } catch (error) {
        failedCount++
        context.error(`❌ Failed to process ${file.filename}:`, error)
        results.push({
          filename: file.filename,
          success: false,
          error: error instanceof Error ? error.message : 'Processing failed'
        })
      }
    }

    // Update evaluation status
    const finalStatus = failedCount === 0 ? 'completed' : 'completed_with_errors'
    await updateEvaluationStatus(pool, evaluationId, {
      status: finalStatus,
      filesProcessed: processedCount,
      filesFailed: failedCount,
      completedAt: new Date()
    })

    // Send completion notification
    await sendCompletionNotification({
      evaluationId,
      userEmail: data.userEmail,
      roleTitle: data.roleTitle,
      totalFiles: data.files.length,
      processedCount,
      failedCount,
      avgScore: calculateAvgScore(results)
    }, context)

    const processingTime = Date.now() - startTime
    context.log(`✅ Evaluation ${evaluationId} completed in ${processingTime}ms`)
    context.log(`📊 Results: ${processedCount} succeeded, ${failedCount} failed`)

  } catch (error) {
    context.error('❌ Evaluation processing failed:', error)
    
    // Update status to failed
    if (evaluationId) {
      try {
        const pool = await getDbConnection()
        await updateEvaluationStatus(pool, evaluationId, {
          status: 'failed',
          completedAt: new Date()
        })
      } catch (updateError) {
        context.error('Failed to update status:', updateError)
      }
    }

    // Re-throw for Service Bus retry
    throw error
  }
}

/**
 * Analyze resume with Hyperbolic AI
 */
async function analyzeWithAI(
  text: string,
  roleTitle: string,
  skills: any[],
  questions: any[],
  context: InvocationContext
): Promise<any> {
  const apiKey = process.env.HYPERBOLIC_API_KEY
  
  if (!apiKey) {
    throw new Error('Hyperbolic API key not configured')
  }

  // Build prompt
  const skillsList = skills.map(s => 
    `- ${s.skill_name} (weight: ${s.weight}, required: ${s.is_required})`
  ).join('\n')

  const questionsList = questions.map(q => 
    `- ${q.question_text} (weight: ${q.weight})`
  ).join('\n')

  const prompt = `
You are an expert HR AI assistant analyzing a resume for the role of ${roleTitle}.

RESUME TEXT:
${text.substring(0, 8000)} // Limit text length

REQUIRED SKILLS:
${skillsList}

EVALUATION QUESTIONS:
${questionsList}

Please analyze this resume and provide:
1. Overall score (0-100)
2. Skills analysis for each skill (found/not found, evidence)
3. Answers to each evaluation question
4. Top 3 recommendations (positive points)
5. Any red flags or concerns

Return the response in this exact JSON format:
{
  "overallScore": number,
  "skillsAnalysis": [
    {
      "skill": "skill name",
      "found": boolean,
      "confidence": number (0-100),
      "evidence": "text evidence from resume"
    }
  ],
  "questionsAnalysis": [
    {
      "question": "question text",
      "answer": "your assessment",
      "score": number (0-10)
    }
  ],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "redFlags": ["concern 1", "concern 2"] or []
}
`

  try {
    const response = await axios.post(
      'https://api.hyperbolic.xyz/v1/completions',
      {
        model: 'meta-llama/Llama-3.1-8B-Instruct',
        prompt,
        max_tokens: 2000,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 seconds
      }
    )

    const result = response.data.choices[0].text
    return JSON.parse(result)

  } catch (error) {
    context.error('AI analysis failed:', error)
    
    // Return default analysis on error
    return {
      overallScore: 0,
      skillsAnalysis: skills.map(s => ({
        skill: s.skill_name,
        found: false,
        confidence: 0,
        evidence: 'Analysis failed'
      })),
      questionsAnalysis: questions.map(q => ({
        question: q.question_text,
        answer: 'Unable to analyze',
        score: 0
      })),
      recommendations: ['Unable to generate recommendations'],
      redFlags: ['Analysis failed - manual review required']
    }
  }
}

/**
 * Send completion notification
 */
async function sendCompletionNotification(
  data: {
    evaluationId: string
    userEmail: string
    roleTitle: string
    totalFiles: number
    processedCount: number
    failedCount: number
    avgScore: number
  },
  context: InvocationContext
): Promise<void> {
  try {
    const vercelUrl = process.env.VERCEL_APP_URL
    const internalKey = process.env.INTERNAL_API_KEY

    if (!vercelUrl || !internalKey) {
      context.warn('Notification configuration missing')
      return
    }

    // Call Vercel notification endpoint
    await axios.post(
      `${vercelUrl}/api/notifications/evaluation`,
      {
        evaluationId: data.evaluationId,
        userEmail: data.userEmail,
        roleTitle: data.roleTitle,
        totalFiles: data.totalFiles,
        processedCount: data.processedCount,
        failedCount: data.failedCount,
        avgScore: data.avgScore
      },
      {
        headers: {
          'Authorization': `Bearer ${internalKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    )

    context.log(`📧 Notification sent to ${data.userEmail}`)

  } catch (error) {
    context.error('Failed to send notification:', error)
    // Don't throw - notifications are not critical
  }
}

/**
 * Calculate average score from results
 */
function calculateAvgScore(results: any[]): number {
  const scores = results
    .filter(r => r.success && r.score !== undefined)
    .map(r => r.score)
  
  if (scores.length === 0) return 0
  
  const sum = scores.reduce((acc, score) => acc + score, 0)
  return Math.round(sum / scores.length)
}

// Register the function
app.serviceBusQueue('evaluationQueueProcessor', {
  connection: 'AZURE_SERVICE_BUS_CONNECTION_STRING',
  queueName: 'evaluation-queue',
  handler: evaluationQueueProcessor
})

export { evaluationQueueProcessor }