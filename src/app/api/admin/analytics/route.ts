import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db-utils"

export async function GET(request: NextRequest) {
  try {
    // Get comprehensive analytics data
    const analytics = await executeQuery(async (pool) => {
      // User statistics
      const userStats = await pool.request().query(`
        SELECT 
          COUNT(*) as totalUsers,
          COUNT(CASE WHEN created_at > DATEADD(day, -7, GETDATE()) THEN 1 END) as newUsersThisWeek,
          COUNT(CASE WHEN created_at > DATEADD(day, -30, GETDATE()) THEN 1 END) as newUsersThisMonth
        FROM users
      `)

      // Role statistics
      const roleStats = await pool.request().query(`
        SELECT 
          COUNT(*) as totalRoles,
          COUNT(CASE WHEN created_at > DATEADD(day, -7, GETDATE()) THEN 1 END) as rolesCreatedThisWeek,
          AVG(CASE WHEN skills_count IS NOT NULL THEN skills_count ELSE 0 END) as avgSkillsPerRole
        FROM roles
      `)

      // Evaluation statistics
      const evalStats = await pool.request().query(`
        SELECT 
          COUNT(*) as totalEvaluations,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedEvaluations,
          COUNT(CASE WHEN status = 'processing' THEN 1 END) as processingEvaluations,
          AVG(total_files) as avgFilesPerEvaluation
        FROM evaluation_sessions
      `)

      // Recent user activity
      const recentUsers = await pool.request().query(`
        SELECT TOP 10
          u.id,
          u.email,
          u.company_name,
          u.created_at,
          COUNT(r.id) as roleCount,
          COUNT(es.id) as evaluationCount
        FROM users u
        LEFT JOIN roles r ON u.id = r.user_id
        LEFT JOIN evaluation_sessions es ON u.id = es.user_id
        GROUP BY u.id, u.email, u.company_name, u.created_at
        ORDER BY u.created_at DESC
      `)

      // System usage by day (last 30 days)
      const dailyUsage = await pool.request().query(`
        SELECT 
          CAST(created_at as DATE) as date,
          COUNT(*) as evaluations,
          SUM(total_files) as filesProcessed
        FROM evaluation_sessions
        WHERE created_at > DATEADD(day, -30, GETDATE())
        GROUP BY CAST(created_at as DATE)
        ORDER BY date DESC
      `)

      return {
        userStats: userStats.recordset[0],
        roleStats: roleStats.recordset[0], 
        evalStats: evalStats.recordset[0],
        recentUsers: recentUsers.recordset,
        dailyUsage: dailyUsage.recordset
      }
    })

    return NextResponse.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Analytics fetch error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    )
  }
}