import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions'
import { withSecurity, AuthenticatedUser } from '../middleware/security-middleware'
import { requireResourceAccess } from '../middleware/authorization-middleware'
import { validateInput, schemas, ValidationError } from '../shared/validation-utils'
import { getDbManager } from '../shared/enhanced-db-utils'

interface GetResultsQuery {
  limit?: number
  offset?: number
  status?: string
  dateFrom?: string
  dateTo?: string
  scoreMin?: number
  scoreMax?: number
  recommendation?: string
}

/**
 * Get Evaluation Results - Secure endpoint with full authentication
 */
async function getEvaluationResults(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  
  return withSecurity(
    request,
    context,
    {
      requireAuth: true,
      rateLimitType: 'user'
    },
    async (user: AuthenticatedUser) => {
      try {
        const sessionId = request.params.sessionId
        if (!sessionId) {
          return {
            status: 400,
            jsonBody: { error: 'Session ID is required' }
          }
        }

        // Validate session ID format
        const validatedSessionId = validateInput(
          { sessionId },
          schemas.sessionId.required(),
          context
        ).sessionId

        // Check resource ownership
        const authResult = await requireResourceAccess(
          user!,
          'session',
          validatedSessionId,
          'read',
          context
        )

        if (!authResult.authorized) {
          return {
            status: 403,
            jsonBody: { error: authResult.error }
          }
        }

        // Parse and validate query parameters
        const queryParams: GetResultsQuery = {
          limit: request.query.get('limit') ? parseInt(request.query.get('limit')!) : undefined,
          offset: request.query.get('offset') ? parseInt(request.query.get('offset')!) : undefined,
          status: request.query.get('status') || undefined,
          dateFrom: request.query.get('dateFrom') || undefined,
          dateTo: request.query.get('dateTo') || undefined,
          scoreMin: request.query.get('scoreMin') ? parseFloat(request.query.get('scoreMin')!) : undefined,
          scoreMax: request.query.get('scoreMax') ? parseFloat(request.query.get('scoreMax')!) : undefined,
          recommendation: request.query.get('recommendation') || undefined
        }

        const validatedQuery = validateInput(queryParams, schemas.queryFilters, context)

        // Get session details
        const dbManager = getDbManager()
        const sessionResult = await dbManager.executeQuery(
          `SELECT 
             bs.sessionId,
             bs.status,
             bs.createdAt,
             bs.completedAt,
             bs.totalFiles,
             bs.totalProcessed,
             bs.totalFailed,
             r.title as roleTitle,
             r.department as roleDepartment
           FROM batch_sessions bs
           LEFT JOIN roles r ON bs.roleId = r.id
           WHERE bs.sessionId = @sessionId`,
          { sessionId: validatedSessionId }
        )

        if (!sessionResult.length) {
          return {
            status: 404,
            jsonBody: { error: 'Session not found' }
          }
        }

        const session = sessionResult[0]

        // Build results query with filters
        let resultsQuery = `
          SELECT 
            uf.id as fileId,
            uf.fileName,
            uf.originalFilename,
            uf.uploadedDate,
            uf.processingStatus,
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
          WHERE uf.sessionId = @sessionId
        `

        const queryParams: any = { sessionId: validatedSessionId }

        // Add filters
        if (validatedQuery.status) {
          resultsQuery += ' AND uf.processingStatus = @status'
          queryParams.status = validatedQuery.status
        }

        if (validatedQuery.dateFrom) {
          resultsQuery += ' AND uf.uploadedDate >= @dateFrom'
          queryParams.dateFrom = validatedQuery.dateFrom
        }

        if (validatedQuery.dateTo) {
          resultsQuery += ' AND uf.uploadedDate <= @dateTo'
          queryParams.dateTo = validatedQuery.dateTo
        }

        if (validatedQuery.scoreMin !== undefined) {
          resultsQuery += ' AND rar.overallScore >= @scoreMin'
          queryParams.scoreMin = validatedQuery.scoreMin
        }

        if (validatedQuery.scoreMax !== undefined) {
          resultsQuery += ' AND rar.overallScore <= @scoreMax'
          queryParams.scoreMax = validatedQuery.scoreMax
        }

        if (validatedQuery.recommendation) {
          resultsQuery += ' AND rar.recommendation = @recommendation'
          queryParams.recommendation = validatedQuery.recommendation
        }

        // Add ordering and pagination
        resultsQuery += `
          ORDER BY rar.overallScore DESC, uf.uploadedDate DESC
          OFFSET @offset ROWS
          FETCH NEXT @limit ROWS ONLY
        `
        queryParams.offset = validatedQuery.offset
        queryParams.limit = validatedQuery.limit

        // Get total count for pagination
        let countQuery = `
          SELECT COUNT(*) as total
          FROM uploaded_files uf
          LEFT JOIN resume_analysis_results rar ON uf.id = rar.fileId
          WHERE uf.sessionId = @sessionId
        `

        // Apply same filters to count query
        if (validatedQuery.status) countQuery += ' AND uf.processingStatus = @status'
        if (validatedQuery.dateFrom) countQuery += ' AND uf.uploadedDate >= @dateFrom'
        if (validatedQuery.dateTo) countQuery += ' AND uf.uploadedDate <= @dateTo'
        if (validatedQuery.scoreMin !== undefined) countQuery += ' AND rar.overallScore >= @scoreMin'
        if (validatedQuery.scoreMax !== undefined) countQuery += ' AND rar.overallScore <= @scoreMax'
        if (validatedQuery.recommendation) countQuery += ' AND rar.recommendation = @recommendation'

        // Execute queries
        const [results, countResult] = await Promise.all([
          dbManager.executeQuery(resultsQuery, queryParams),
          dbManager.executeQuery(countQuery, queryParams)
        ])

        const total = countResult[0]?.total || 0

        // Calculate statistics
        const stats = calculateEvaluationStats(results)

        // Format results
        const formattedResults = results.map(formatResultForClient)

        context.log('Evaluation results retrieved', {
          sessionId: validatedSessionId,
          userId: user!.id,
          totalResults: total,
          returnedResults: formattedResults.length,
          filters: validatedQuery
        })

        return {
          status: 200,
          jsonBody: {
            sessionId: validatedSessionId,
            session: {
              status: session.status,
              createdAt: session.createdAt,
              completedAt: session.completedAt,
              totalFiles: session.totalFiles,
              totalProcessed: session.totalProcessed,
              totalFailed: session.totalFailed,
              role: {
                title: session.roleTitle,
                department: session.roleDepartment
              }
            },
            pagination: {
              total,
              limit: validatedQuery.limit,
              offset: validatedQuery.offset,
              hasMore: validatedQuery.offset + validatedQuery.limit < total
            },
            statistics: stats,
            results: formattedResults
          }
        }

      } catch (error) {
        context.error('Error retrieving evaluation results', {
          sessionId: request.params.sessionId,
          userId: user?.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })

        if (error instanceof ValidationError) {
          return {
            status: 400,
            jsonBody: { error: error.message }
          }
        }

        return {
          status: 500,
          jsonBody: { error: 'Internal server error' }
        }
      }
    }
  )
}

/**
 * Get Session Progress - Secure endpoint
 */
async function getSessionProgress(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  
  return withSecurity(
    request,
    context,
    {
      requireAuth: true,
      rateLimitType: 'user'
    },
    async (user: AuthenticatedUser) => {
      try {
        const sessionId = request.params.sessionId
        if (!sessionId) {
          return {
            status: 400,
            jsonBody: { error: 'Session ID is required' }
          }
        }

        const validatedSessionId = validateInput(
          { sessionId },
          schemas.sessionId.required(),
          context
        ).sessionId

        // Check resource ownership
        const authResult = await requireResourceAccess(
          user!,
          'session',
          validatedSessionId,
          'read',
          context
        )

        if (!authResult.authorized) {
          return {
            status: 403,
            jsonBody: { error: authResult.error }
          }
        }

        // Get detailed progress information
        const dbManager = getDbManager()
        const progressResult = await dbManager.executeQuery(`
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
            SUM(CASE WHEN uf.processingStatus = 'failed' THEN 1 ELSE 0 END) as failedFiles,
            AVG(CASE WHEN rar.overallScore IS NOT NULL THEN rar.overallScore END) as avgScore,
            SUM(rar.aiCost) as totalCost
          FROM batch_sessions bs
          LEFT JOIN uploaded_files uf ON bs.sessionId = uf.sessionId
          LEFT JOIN resume_analysis_results rar ON uf.id = rar.fileId
          WHERE bs.sessionId = @sessionId
          GROUP BY bs.sessionId, bs.status, bs.createdAt, bs.completedAt, bs.totalFiles, bs.totalProcessed, bs.totalFailed
        `, { sessionId: validatedSessionId })

        if (!progressResult.length) {
          return {
            status: 404,
            jsonBody: { error: 'Session not found' }
          }
        }

        const progress = progressResult[0]
        const completedFiles = (progress.analyzedFiles || 0) + (progress.failedFiles || 0)
        const totalFiles = progress.currentFiles || 0
        const progressPercentage = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0

        // Estimate completion time if still processing
        let estimatedCompletion: string | null = null
        if (progress.status === 'processing' && completedFiles > 0 && completedFiles < totalFiles) {
          const startTime = new Date(progress.createdAt).getTime()
          const now = Date.now()
          const elapsed = now - startTime
          const avgTimePerFile = elapsed / completedFiles
          const remainingFiles = totalFiles - completedFiles
          const estimatedRemainingTime = remainingFiles * avgTimePerFile
          estimatedCompletion = new Date(now + estimatedRemainingTime).toISOString()
        }

        context.log('Session progress retrieved', {
          sessionId: validatedSessionId,
          userId: user!.id,
          status: progress.status,
          progressPercentage
        })

        return {
          status: 200,
          jsonBody: {
            sessionId: validatedSessionId,
            status: progress.status,
            progress: {
              totalFiles: totalFiles,
              completedFiles: completedFiles,
              progressPercentage: progressPercentage,
              breakdown: {
                uploaded: progress.uploadedFiles || 0,
                processing: progress.processingFiles || 0,
                analyzing: progress.analyzingFiles || 0,
                analyzed: progress.analyzedFiles || 0,
                failed: progress.failedFiles || 0
              }
            },
            statistics: {
              averageScore: progress.avgScore ? Math.round(progress.avgScore) : null,
              totalCost: progress.totalCost ? Math.round(progress.totalCost * 10000) / 10000 : 0
            },
            timestamps: {
              createdAt: progress.createdAt,
              completedAt: progress.completedAt,
              estimatedCompletion
            }
          }
        }

      } catch (error) {
        context.error('Error retrieving session progress', {
          sessionId: request.params.sessionId,
          userId: user?.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })

        if (error instanceof ValidationError) {
          return {
            status: 400,
            jsonBody: { error: error.message }
          }
        }

        return {
          status: 500,
          jsonBody: { error: 'Internal server error' }
        }
      }
    }
  )
}

/**
 * Calculate evaluation statistics
 */
function calculateEvaluationStats(results: any[]) {
  const processedResults = results.filter(r => r.overallScore !== null)
  const scores = processedResults.map(r => r.overallScore)
  
  if (scores.length === 0) {
    return {
      totalCandidates: results.length,
      processedCandidates: 0,
      failedCandidates: results.length,
      averageScore: null,
      medianScore: null,
      topScore: null,
      recommendations: { accept: 0, maybe: 0, reject: 0 },
      scoreDistribution: { excellent: 0, good: 0, average: 0, poor: 0 }
    }
  }

  const sortedScores = [...scores].sort((a, b) => a - b)
  const medianIndex = Math.floor(sortedScores.length / 2)
  const median = sortedScores.length % 2 === 0
    ? (sortedScores[medianIndex - 1] + sortedScores[medianIndex]) / 2
    : sortedScores[medianIndex]

  const recommendations = processedResults.reduce((acc, r) => {
    const rec = r.recommendation || 'maybe'
    acc[rec] = (acc[rec] || 0) + 1
    return acc
  }, { accept: 0, maybe: 0, reject: 0 })

  const scoreDistribution = scores.reduce((acc, score) => {
    if (score >= 90) acc.excellent++
    else if (score >= 75) acc.good++
    else if (score >= 60) acc.average++
    else acc.poor++
    return acc
  }, { excellent: 0, good: 0, average: 0, poor: 0 })

  return {
    totalCandidates: results.length,
    processedCandidates: processedResults.length,
    failedCandidates: results.length - processedResults.length,
    averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    medianScore: Math.round(median),
    topScore: Math.max(...scores),
    recommendations,
    scoreDistribution
  }
}

/**
 * Format result for client response
 */
function formatResultForClient(result: any) {
  // Parse JSON fields safely
  const parseJsonField = (field: string) => {
    try {
      return field ? JSON.parse(field) : []
    } catch {
      return []
    }
  }

  return {
    fileId: result.fileId,
    fileName: result.originalFilename || result.fileName,
    uploadedDate: result.uploadedDate,
    processingStatus: result.processingStatus,
    scores: result.overallScore !== null ? {
      overall: result.overallScore,
      technical: result.technicalScore,
      experience: result.experienceScore,
      education: result.educationScore,
      skills: result.skillsScore,
      cultureFit: result.cultureFitScore
    } : null,
    recommendation: result.recommendation,
    summary: result.executiveSummary,
    analysis: result.detailedAnalysis,
    strengths: parseJsonField(result.topStrengths),
    concerns: parseJsonField(result.concernsGaps),
    redFlags: parseJsonField(result.redFlags),
    achievements: parseJsonField(result.standoutAchievements),
    interviewQuestions: parseJsonField(result.interviewQuestions),
    recommendationReason: result.recommendationReason,
    metadata: result.overallScore !== null ? {
      aiModel: result.aiModelUsed,
      processingTime: result.processingTimeSeconds,
      cost: result.aiCost,
      analyzedDate: result.analyzedDate
    } : null
  }
}

// Register secure HTTP functions
app.http('getEvaluationResults', {
  methods: ['GET'],
  route: 'evaluations/{sessionId}/results',
  authLevel: 'anonymous', // Security handled by middleware
  handler: getEvaluationResults
})

app.http('getSessionProgress', {
  methods: ['GET'],
  route: 'evaluations/{sessionId}/progress',
  authLevel: 'anonymous', // Security handled by middleware
  handler: getSessionProgress
})

export { getEvaluationResults, getSessionProgress }