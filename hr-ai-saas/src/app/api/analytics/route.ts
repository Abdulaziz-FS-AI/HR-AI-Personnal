import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { executeQuery } from '@/lib/db-utils'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || 'last-30-days'
    
    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    
    switch (timeRange) {
      case 'last-7-days':
        startDate.setDate(endDate.getDate() - 7)
        break
      case 'last-30-days':
        startDate.setDate(endDate.getDate() - 30)
        break
      case 'last-90-days':
        startDate.setDate(endDate.getDate() - 90)
        break
      case 'last-year':
        startDate.setFullYear(endDate.getFullYear() - 1)
        break
    }

    const analyticsData = await executeQuery(async (pool) => {
      // Get total evaluations
      const evaluationsResult = await pool.request()
        .input('userId', session.user.id)
        .input('startDate', startDate)
        .input('endDate', endDate)
        .query(`
          SELECT 
            COUNT(DISTINCT batch_session_id) as totalEvaluations,
            COUNT(*) as totalResumes,
            AVG(DATEDIFF(minute, rar.created_at, rar.updated_at)) as avgProcessingTime
          FROM resume_analysis_results rar
          WHERE rar.user_id = @userId
          AND rar.created_at BETWEEN @startDate AND @endDate
        `)
      
      const { totalEvaluations, totalResumes, avgProcessingTime } = evaluationsResult.recordset[0]
      
      // Get top skills in demand
      const skillsResult = await pool.request()
        .input('userId', session.user.id)
        .input('startDate', startDate)
        .input('endDate', endDate)
        .query(`
          SELECT TOP 10
            sa.skill_name as skill,
            COUNT(*) as count,
            CAST(COUNT(*) * 100.0 / (
              SELECT COUNT(DISTINCT rar.id)
              FROM resume_analysis_results rar
              WHERE rar.user_id = @userId
              AND rar.created_at BETWEEN @startDate AND @endDate
            ) AS INT) as percentage
          FROM skills_analysis sa
          JOIN resume_analysis_results rar ON sa.analysis_id = rar.id
          WHERE rar.user_id = @userId
          AND rar.created_at BETWEEN @startDate AND @endDate
          GROUP BY sa.skill_name
          ORDER BY count DESC
        `)
      
      // Get evaluation trends by month
      const trendsResult = await pool.request()
        .input('userId', session.user.id)
        .input('startDate', startDate)
        .input('endDate', endDate)
        .query(`
          SELECT 
            DATENAME(month, created_at) as month,
            COUNT(DISTINCT batch_session_id) as evaluations,
            AVG(overall_score) as avgScore
          FROM resume_analysis_results
          WHERE user_id = @userId
          AND created_at BETWEEN @startDate AND @endDate
          GROUP BY DATENAME(month, created_at), MONTH(created_at)
          ORDER BY MONTH(created_at)
        `)
      
      // Get role performance
      const rolePerformanceResult = await pool.request()
        .input('userId', session.user.id)
        .input('startDate', startDate)
        .input('endDate', endDate)
        .query(`
          SELECT 
            r.title as role,
            COUNT(DISTINCT rar.id) as totalCandidates,
            AVG(rar.overall_score) as avgScore,
            COUNT(CASE WHEN rar.overall_score >= 80 THEN 1 END) as topCandidates
          FROM resume_analysis_results rar
          JOIN roles r ON rar.role_id = r.id
          WHERE rar.user_id = @userId
          AND rar.created_at BETWEEN @startDate AND @endDate
          GROUP BY r.title, r.id
          ORDER BY totalCandidates DESC
        `)
      
      // Get candidate distribution
      const distributionResult = await pool.request()
        .input('userId', session.user.id)
        .input('startDate', startDate)
        .input('endDate', endDate)
        .query(`
          WITH ScoreRanges AS (
            SELECT 
              CASE 
                WHEN overall_score >= 90 THEN '90-100%'
                WHEN overall_score >= 80 THEN '80-89%'
                WHEN overall_score >= 70 THEN '70-79%'
                WHEN overall_score >= 60 THEN '60-69%'
                WHEN overall_score >= 50 THEN '50-59%'
                ELSE 'Below 50%'
              END as scoreRange,
              COUNT(*) as count
            FROM resume_analysis_results
            WHERE user_id = @userId
            AND created_at BETWEEN @startDate AND @endDate
            GROUP BY 
              CASE 
                WHEN overall_score >= 90 THEN '90-100%'
                WHEN overall_score >= 80 THEN '80-89%'
                WHEN overall_score >= 70 THEN '70-79%'
                WHEN overall_score >= 60 THEN '60-69%'
                WHEN overall_score >= 50 THEN '50-59%'
                ELSE 'Below 50%'
              END
          )
          SELECT 
            scoreRange,
            count,
            CAST(count * 100.0 / SUM(count) OVER() AS INT) as percentage
          FROM ScoreRanges
          ORDER BY 
            CASE scoreRange
              WHEN '90-100%' THEN 1
              WHEN '80-89%' THEN 2
              WHEN '70-79%' THEN 3
              WHEN '60-69%' THEN 4
              WHEN '50-59%' THEN 5
              ELSE 6
            END
        `)
      
      return {
        totalEvaluations: totalEvaluations || 0,
        totalResumes: totalResumes || 0,
        averageProcessingTime: Math.round(avgProcessingTime || 0) / 60, // Convert to minutes
        topSkillsInDemand: skillsResult.recordset || [],
        evaluationTrends: trendsResult.recordset.map(trend => ({
          month: trend.month.substring(0, 3), // Shorten month name
          evaluations: trend.evaluations,
          avgScore: Math.round(trend.avgScore || 0)
        })),
        rolePerformance: rolePerformanceResult.recordset.map(role => ({
          ...role,
          avgScore: Math.round(role.avgScore || 0)
        })),
        candidateDistribution: distributionResult.recordset || []
      }
    })

    return NextResponse.json(analyticsData)
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch analytics data',
        // Return empty structure so the UI doesn't break
        totalEvaluations: 0,
        totalResumes: 0,
        averageProcessingTime: 0,
        topSkillsInDemand: [],
        evaluationTrends: [],
        rolePerformance: [],
        candidateDistribution: []
      },
      { status: 500 }
    )
  }
}