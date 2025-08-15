import { NextRequest, NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db-config'
import { resolveUserContext } from '@/lib/auth/user-resolver'
import { withErrorHandler, createSuccessResponse, createErrorResponse } from '@/lib/api/error-handler'

interface AnalyticsData {
  totalEvaluations: number
  totalResumes: number
  averageProcessingTime: number
  topSkillsInDemand: Array<{ skill: string; count: number; percentage: number }>
  evaluationTrends: Array<{ month: string; evaluations: number; avgScore: number }>
  rolePerformance: Array<{ role: string; totalCandidates: number; avgScore: number; topCandidates: number }>
  candidateDistribution: Array<{ scoreRange: string; count: number; percentage: number }>
}

async function analyticsHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || 'last-30-days'
    const roleFilter = searchParams.get('role') || 'all'

    // Get user context
    const userContext = await resolveUserContext(request)
    const pool = await getDbConnection()

    // Calculate date range
    let dateFilter = ''
    const now = new Date()
    switch (timeRange) {
      case 'last-7-days':
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        dateFilter = `AND es.created_at >= '${lastWeek.toISOString()}'`
        break
      case 'last-30-days':
        const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        dateFilter = `AND es.created_at >= '${lastMonth.toISOString()}'`
        break
      case 'last-90-days':
        const lastQuarter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        dateFilter = `AND es.created_at >= '${lastQuarter.toISOString()}'`
        break
      case 'last-year':
        const lastYear = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        dateFilter = `AND es.created_at >= '${lastYear.toISOString()}'`
        break
    }

    // Role filter
    let roleFilter_sql = ''
    if (roleFilter !== 'all') {
      roleFilter_sql = `AND r.id = '${roleFilter}'`
    }

    // Get total evaluations
    const totalEvaluationsQuery = `
      SELECT COUNT(*) as count
      FROM evaluation_sessions es
      WHERE es.user_id = @userId
      ${dateFilter}
    `
    const totalEvaluationsResult = await pool.request()
      .input('userId', userContext.userId)
      .query(totalEvaluationsQuery)
    const totalEvaluations = totalEvaluationsResult.recordset[0]?.count || 0

    // Get total resumes processed
    const totalResumesQuery = `
      SELECT COUNT(*) as count
      FROM evaluation_files ef
      JOIN evaluation_sessions es ON ef.session_id = es.id
      WHERE es.user_id = @userId
      ${dateFilter}
    `
    const totalResumesResult = await pool.request()
      .input('userId', userContext.userId)
      .query(totalResumesQuery)
    const totalResumes = totalResumesResult.recordset[0]?.count || 0

    // Get average processing time (in minutes)
    const avgProcessingQuery = `
      SELECT AVG(DATEDIFF(minute, es.created_at, es.updated_at)) as avg_time
      FROM evaluation_sessions es
      WHERE es.user_id = @userId
      AND es.status = 'completed'
      ${dateFilter}
    `
    const avgProcessingResult = await pool.request()
      .input('userId', userContext.userId)
      .query(avgProcessingQuery)
    const averageProcessingTime = Math.round(avgProcessingResult.recordset[0]?.avg_time || 0)

    // Get top skills in demand (from role_skills)
    const topSkillsQuery = `
      SELECT TOP 10 
        rs.skill_name as skill,
        COUNT(*) as count,
        (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM role_skills rs2 
                             JOIN roles r2 ON rs2.role_id = r2.id 
                             WHERE r2.user_id = @userId)) as percentage
      FROM role_skills rs
      JOIN roles r ON rs.role_id = r.id
      WHERE r.user_id = @userId
      ${roleFilter_sql.replace('es.', 'r.')}
      GROUP BY rs.skill_name
      ORDER BY count DESC
    `
    const topSkillsResult = await pool.request()
      .input('userId', userContext.userId)
      .query(topSkillsQuery)
    const topSkillsInDemand = topSkillsResult.recordset.map(row => ({
      skill: row.skill,
      count: row.count,
      percentage: Math.round(row.percentage || 0)
    }))

    // Get evaluation trends (monthly)
    const trendsQuery = `
      SELECT 
        FORMAT(es.created_at, 'yyyy-MM') as month,
        COUNT(*) as evaluations,
        ISNULL(AVG(CAST(er.overall_score as float)), 0) as avgScore
      FROM evaluation_sessions es
      LEFT JOIN evaluation_results er ON es.id = er.session_id
      WHERE es.user_id = @userId
      ${dateFilter}
      GROUP BY FORMAT(es.created_at, 'yyyy-MM')
      ORDER BY month DESC
    `
    const trendsResult = await pool.request()
      .input('userId', userContext.userId)
      .query(trendsQuery)
    const evaluationTrends = trendsResult.recordset.map(row => ({
      month: row.month,
      evaluations: row.evaluations,
      avgScore: Math.round(row.avgScore || 0)
    }))

    // Get role performance
    const rolePerformanceQuery = `
      SELECT 
        r.title as role,
        COUNT(DISTINCT ef.id) as totalCandidates,
        ISNULL(AVG(CAST(er.overall_score as float)), 0) as avgScore,
        COUNT(CASE WHEN CAST(er.overall_score as float) >= 80 THEN 1 END) as topCandidates
      FROM roles r
      LEFT JOIN evaluation_sessions es ON r.id = es.role_id
      LEFT JOIN evaluation_files ef ON es.id = ef.session_id
      LEFT JOIN evaluation_results er ON ef.id = er.file_id
      WHERE r.user_id = @userId
      ${dateFilter.replace('es.', 'es.')}
      ${roleFilter_sql.replace('r.', 'r.')}
      GROUP BY r.id, r.title
      HAVING COUNT(DISTINCT ef.id) > 0
      ORDER BY avgScore DESC
    `
    const rolePerformanceResult = await pool.request()
      .input('userId', userContext.userId)
      .query(rolePerformanceQuery)
    const rolePerformance = rolePerformanceResult.recordset.map(row => ({
      role: row.role,
      totalCandidates: row.totalCandidates,
      avgScore: Math.round(row.avgScore || 0),
      topCandidates: row.topCandidates
    }))

    // Get candidate score distribution
    const distributionQuery = `
      SELECT 
        CASE 
          WHEN CAST(er.overall_score as float) >= 90 THEN '90-100%'
          WHEN CAST(er.overall_score as float) >= 80 THEN '80-89%'
          WHEN CAST(er.overall_score as float) >= 70 THEN '70-79%'
          WHEN CAST(er.overall_score as float) >= 60 THEN '60-69%'
          WHEN CAST(er.overall_score as float) >= 50 THEN '50-59%'
          ELSE 'Below 50%'
        END as scoreRange,
        COUNT(*) as count
      FROM evaluation_results er
      JOIN evaluation_files ef ON er.file_id = ef.id
      JOIN evaluation_sessions es ON ef.session_id = es.id
      WHERE es.user_id = @userId
      AND er.overall_score IS NOT NULL
      ${dateFilter}
      GROUP BY 
        CASE 
          WHEN CAST(er.overall_score as float) >= 90 THEN '90-100%'
          WHEN CAST(er.overall_score as float) >= 80 THEN '80-89%'
          WHEN CAST(er.overall_score as float) >= 70 THEN '70-79%'
          WHEN CAST(er.overall_score as float) >= 60 THEN '60-69%'
          WHEN CAST(er.overall_score as float) >= 50 THEN '50-59%'
          ELSE 'Below 50%'
        END
      ORDER BY 
        CASE 
          WHEN CAST(er.overall_score as float) >= 90 THEN 1
          WHEN CAST(er.overall_score as float) >= 80 THEN 2
          WHEN CAST(er.overall_score as float) >= 70 THEN 3
          WHEN CAST(er.overall_score as float) >= 60 THEN 4
          WHEN CAST(er.overall_score as float) >= 50 THEN 5
          ELSE 6
        END
    `
    const distributionResult = await pool.request()
      .input('userId', userContext.userId)
      .query(distributionQuery)
    
    const totalCandidates = distributionResult.recordset.reduce((sum, row) => sum + row.count, 0)
    const candidateDistribution = distributionResult.recordset.map(row => ({
      scoreRange: row.scoreRange,
      count: row.count,
      percentage: totalCandidates > 0 ? Math.round((row.count * 100) / totalCandidates) : 0
    }))

    await pool.close()

    const analyticsData: AnalyticsData = {
      totalEvaluations,
      totalResumes,
      averageProcessingTime,
      topSkillsInDemand,
      evaluationTrends,
      rolePerformance,
      candidateDistribution
    }

    return createSuccessResponse(analyticsData)

  } catch (error) {
    console.error('Analytics error:', error)
    return createErrorResponse({
      code: 'ANALYTICS_ERROR',
      message: 'Failed to fetch analytics data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
}

export const GET = withErrorHandler(analyticsHandler)