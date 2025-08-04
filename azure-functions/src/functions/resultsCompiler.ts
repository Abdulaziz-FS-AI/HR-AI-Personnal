import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions'
import { executeQuery } from '../shared/db-utils'

interface EvaluationResult {
  fileId: string
  fileName: string
  originalFilename: string
  overallScore: number
  technicalScore: number
  experienceScore: number
  educationScore: number
  skillsScore: number
  cultureFitScore: number
  recommendation: string
  executiveSummary: string
  detailedAnalysis: string
  topStrengths: string[]
  concernsGaps: string[]
  redFlags: string[]
  standoutAchievements: string[]
  interviewQuestions: string[]
  recommendationReason: string
  matchedSkills: Record<string, string>
  missingRequiredSkills: string[]
  aiModelUsed: string
  processingTimeSeconds: number
  aiCost: number
  analyzedDate: Date
  contactInfo?: {
    name?: string
    email?: string
    phone?: string
  }
}

interface EvaluationStats {
  totalCandidates: number
  processedCandidates: number
  failedCandidates: number
  averageScore: number
  medianScore: number
  topScore: number
  acceptRecommendations: number
  maybeRecommendations: number
  rejectRecommendations: number
  scoreDistribution: {
    excellent: number    // 90-100
    good: number        // 75-89
    average: number     // 60-74
    poor: number        // < 60
  }
  processingStats: {
    totalProcessingTime: number
    averageProcessingTime: number
    totalAICost: number
    averageAICost: number
  }
}

/**
 * Get Evaluation Results - HTTP Triggered Function
 */
async function getEvaluationResults(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const sessionId = request.params.sessionId
    const userId = request.query.get('userId')

    if (!sessionId) {
      return {
        status: 400,
        jsonBody: { error: 'Session ID is required' }
      }
    }

    if (!userId) {
      return {
        status: 400,
        jsonBody: { error: 'User ID is required' }
      }
    }

    context.log('Getting evaluation results:', { sessionId, userId })

    // Get session details and verify ownership
    const sessionResult = await executeQuery(
      'SELECT * FROM batch_sessions WHERE sessionId = @sessionId AND userId = @userId',
      { sessionId, userId }
    )

    if (!sessionResult.length) {
      return {
        status: 404,
        jsonBody: { error: 'Session not found or access denied' }
      }
    }

    const session = sessionResult[0]

    // Get all results for this session
    const results = await getSessionResults(sessionId)
    
    // Calculate statistics
    const stats = calculateEvaluationStats(results)

    // Sort results by overall score (descending)
    const sortedResults = results.sort((a, b) => b.overallScore - a.overallScore)

    return {
      status: 200,
      jsonBody: {
        sessionId,
        session: {
          status: session.status,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
          roleId: session.roleId,
          totalFiles: session.totalFiles,
          totalProcessed: session.totalProcessed,
          totalFailed: session.totalFailed
        },
        statistics: stats,
        results: sortedResults.map(formatResultForClient)
      }
    }

  } catch (error) {
    context.error('Error getting evaluation results:', error)
    return {
      status: 500,
      jsonBody: { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

/**
 * Get Session Progress - HTTP Triggered Function
 */
async function getSessionProgress(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const sessionId = request.params.sessionId
    const userId = request.query.get('userId')

    if (!sessionId || !userId) {
      return {
        status: 400,
        jsonBody: { error: 'Session ID and User ID are required' }
      }
    }

    // Get session progress
    const progress = await executeQuery(`
      SELECT 
        bs.sessionId,
        bs.status,
        bs.createdAt,
        bs.completedAt,
        bs.totalFiles,
        bs.totalProcessed,
        bs.totalFailed,
        COUNT(uf.id) as currentFiles,
        SUM(CASE WHEN uf.processingStatus = 'uploaded' THEN 1 ELSE 0 END) as uploadedFiles,
        SUM(CASE WHEN uf.processingStatus = 'processing' THEN 1 ELSE 0 END) as processingFiles,
        SUM(CASE WHEN uf.processingStatus = 'analyzing' THEN 1 ELSE 0 END) as analyzingFiles,
        SUM(CASE WHEN uf.processingStatus = 'analyzed' THEN 1 ELSE 0 END) as analyzedFiles,
        SUM(CASE WHEN uf.processingStatus = 'failed' THEN 1 ELSE 0 END) as failedFiles
      FROM batch_sessions bs
      LEFT JOIN uploaded_files uf ON bs.sessionId = uf.sessionId
      WHERE bs.sessionId = @sessionId AND bs.userId = @userId
      GROUP BY bs.sessionId, bs.status, bs.createdAt, bs.completedAt, bs.totalFiles, bs.totalProcessed, bs.totalFailed
    `, { sessionId, userId })

    if (!progress.length) {
      return {
        status: 404,
        jsonBody: { error: 'Session not found' }
      }
    }

    const sessionProgress = progress[0]
    const completedFiles = (sessionProgress.analyzedFiles || 0) + (sessionProgress.failedFiles || 0)
    const totalFiles = sessionProgress.currentFiles || 0
    const progressPercentage = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0

    return {
      status: 200,
      jsonBody: {
        sessionId,
        status: sessionProgress.status,
        progress: {
          totalFiles: totalFiles,
          completedFiles: completedFiles,
          progressPercentage: progressPercentage,
          breakdown: {
            uploaded: sessionProgress.uploadedFiles || 0,
            processing: sessionProgress.processingFiles || 0,
            analyzing: sessionProgress.analyzingFiles || 0,
            analyzed: sessionProgress.analyzedFiles || 0,
            failed: sessionProgress.failedFiles || 0
          }
        },
        timestamps: {
          createdAt: sessionProgress.createdAt,
          completedAt: sessionProgress.completedAt
        }
      }
    }

  } catch (error) {
    context.error('Error getting session progress:', error)
    return {
      status: 500,
      jsonBody: { error: 'Internal server error' }
    }
  }
}

/**
 * Get session results from database
 */
async function getSessionResults(sessionId: string): Promise<EvaluationResult[]> {
  const results = await executeQuery(`
    SELECT 
      uf.id as fileId,
      uf.fileName,
      uf.originalFilename,
      uf.extractedText,
      rar.overallScore,
      rar.technicalScore,
      rar.experienceScore,
      rar.educationScore,
      rar.skillsScore,
      rar.cultureFitScore,
      rar.recommendation,
      rar.executiveSummary,
      rar.detailedAnalysis,
      rar.topStrengths,
      rar.concernsGaps,
      rar.redFlags,
      rar.standoutAchievements,
      rar.interviewQuestions,
      rar.recommendationReason,
      rar.aiModelUsed,
      rar.processingTimeSeconds,
      rar.aiCost,
      rar.createdDate as analyzedDate
    FROM uploaded_files uf
    LEFT JOIN resume_analysis_results rar ON uf.id = rar.fileId
    WHERE uf.sessionId = @sessionId AND uf.processingStatus IN ('analyzed', 'failed')
    ORDER BY rar.overallScore DESC
  `, { sessionId })

  return results.map(result => ({
    fileId: result.fileId,
    fileName: result.fileName,
    originalFilename: result.originalFilename,
    overallScore: result.overallScore || 0,
    technicalScore: result.technicalScore || 0,
    experienceScore: result.experienceScore || 0,
    educationScore: result.educationScore || 0,
    skillsScore: result.skillsScore || 0,
    cultureFitScore: result.cultureFitScore || 0,
    recommendation: result.recommendation || 'failed',
    executiveSummary: result.executiveSummary || 'Analysis failed',
    detailedAnalysis: result.detailedAnalysis || 'No analysis available',
    topStrengths: result.topStrengths ? JSON.parse(result.topStrengths) : [],
    concernsGaps: result.concernsGaps ? JSON.parse(result.concernsGaps) : [],
    redFlags: result.redFlags ? JSON.parse(result.redFlags) : [],
    standoutAchievements: result.standoutAchievements ? JSON.parse(result.standoutAchievements) : [],
    interviewQuestions: result.interviewQuestions ? JSON.parse(result.interviewQuestions) : [],
    recommendationReason: result.recommendationReason || 'No reason available',
    matchedSkills: {},
    missingRequiredSkills: [],
    aiModelUsed: result.aiModelUsed || 'unknown',
    processingTimeSeconds: result.processingTimeSeconds || 0,
    aiCost: result.aiCost || 0,
    analyzedDate: result.analyzedDate || new Date(),
    contactInfo: extractContactInfoFromText(result.extractedText)
  }))
}

/**
 * Calculate evaluation statistics
 */
function calculateEvaluationStats(results: EvaluationResult[]): EvaluationStats {
  const processedResults = results.filter(r => r.overallScore > 0)
  const scores = processedResults.map(r => r.overallScore)
  
  if (scores.length === 0) {
    return {
      totalCandidates: results.length,
      processedCandidates: 0,
      failedCandidates: results.length,
      averageScore: 0,
      medianScore: 0,
      topScore: 0,
      acceptRecommendations: 0,
      maybeRecommendations: 0,
      rejectRecommendations: 0,
      scoreDistribution: { excellent: 0, good: 0, average: 0, poor: 0 },
      processingStats: {
        totalProcessingTime: 0,
        averageProcessingTime: 0,
        totalAICost: 0,
        averageAICost: 0
      }
    }
  }

  const sortedScores = [...scores].sort((a, b) => a - b)
  const medianIndex = Math.floor(sortedScores.length / 2)
  const median = sortedScores.length % 2 === 0
    ? (sortedScores[medianIndex - 1] + sortedScores[medianIndex]) / 2
    : sortedScores[medianIndex]

  const recommendations = processedResults.reduce((acc, r) => {
    acc[r.recommendation] = (acc[r.recommendation] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const scoreDistribution = scores.reduce((acc, score) => {
    if (score >= 90) acc.excellent++
    else if (score >= 75) acc.good++
    else if (score >= 60) acc.average++
    else acc.poor++
    return acc
  }, { excellent: 0, good: 0, average: 0, poor: 0 })

  const totalProcessingTime = processedResults.reduce((sum, r) => sum + r.processingTimeSeconds, 0)
  const totalAICost = processedResults.reduce((sum, r) => sum + r.aiCost, 0)

  return {
    totalCandidates: results.length,
    processedCandidates: processedResults.length,
    failedCandidates: results.length - processedResults.length,
    averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    medianScore: Math.round(median),
    topScore: Math.max(...scores),
    acceptRecommendations: recommendations.accept || 0,
    maybeRecommendations: recommendations.maybe || 0,
    rejectRecommendations: recommendations.reject || 0,
    scoreDistribution,
    processingStats: {
      totalProcessingTime,
      averageProcessingTime: Math.round(totalProcessingTime / processedResults.length),
      totalAICost: Math.round(totalAICost * 10000) / 10000, // Round to 4 decimal places
      averageAICost: Math.round((totalAICost / processedResults.length) * 10000) / 10000
    }
  }
}

/**
 * Format result for client response
 */
function formatResultForClient(result: EvaluationResult) {
  return {
    fileId: result.fileId,
    fileName: result.originalFilename || result.fileName,
    scores: {
      overall: result.overallScore,
      technical: result.technicalScore,
      experience: result.experienceScore,
      education: result.educationScore,
      skills: result.skillsScore,
      cultureFit: result.cultureFitScore
    },
    recommendation: result.recommendation,
    summary: result.executiveSummary,
    analysis: result.detailedAnalysis,
    strengths: result.topStrengths,
    concerns: result.concernsGaps,
    redFlags: result.redFlags,
    achievements: result.standoutAchievements,
    interviewQuestions: result.interviewQuestions,
    recommendationReason: result.recommendationReason,
    contactInfo: result.contactInfo,
    metadata: {
      aiModel: result.aiModelUsed,
      processingTime: result.processingTimeSeconds,
      cost: result.aiCost,
      analyzedDate: result.analyzedDate
    }
  }
}

/**
 * Extract basic contact info from extracted text
 */
function extractContactInfoFromText(extractedText: string | null): { name?: string; email?: string; phone?: string } | undefined {
  if (!extractedText) return undefined

  try {
    const parsed = JSON.parse(extractedText)
    return parsed.contactInfo
  } catch {
    // If not JSON, try basic regex extraction
    const emailMatch = extractedText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
    const phoneMatch = extractedText.match(/(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/i)
    
    return {
      email: emailMatch ? emailMatch[1] : undefined,
      phone: phoneMatch ? phoneMatch[1] : undefined
    }
  }
}

// Register HTTP functions
app.http('getEvaluationResults', {
  methods: ['GET'],
  route: 'evaluations/{sessionId}/results',
  authLevel: 'anonymous',
  handler: getEvaluationResults
})

app.http('getSessionProgress', {
  methods: ['GET'],
  route: 'evaluations/{sessionId}/progress',
  authLevel: 'anonymous',
  handler: getSessionProgress
})

export { getEvaluationResults, getSessionProgress }