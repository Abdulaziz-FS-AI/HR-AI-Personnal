import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'
import sql from 'mssql'

export async function GET() {
  let pool: sql.ConnectionPool | null = null
  
  try {
    pool = await getDbConnection()
    
    // Get all users
    console.log('📋 Fetching all users...')
    const usersResult = await pool.request().query(`
      SELECT 
        id,
        email,
        first_name as firstName,
        last_name as lastName,
        company_name as companyName,
        subscription_tier as subscriptionTier,
        credits_remaining as creditsRemaining,
        created_at as createdAt,
        is_active as isActive
      FROM users 
      ORDER BY created_at DESC
    `)
    
    // Get all roles with user information
    console.log('📋 Fetching all roles...')
    const rolesResult = await pool.request().query(`
      SELECT 
        r.id,
        r.title,
        r.description,
        r.department,
        r.location,
        r.employment_type as employmentType,
        r.seniority_level as seniorityLevel,
        r.min_experience_years as minExperienceYears,
        r.max_experience_years as maxExperienceYears,
        r.created_at as createdAt,
        r.is_active as isActive,
        u.email as createdByEmail,
        u.first_name + ' ' + u.last_name as createdByName
      FROM roles r
      JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `)
    
    // Get role skills for each role
    console.log('📋 Fetching role skills...')
    const skillsResult = await pool.request().query(`
      SELECT 
        rs.role_id as roleId,
        rs.skill_name as skillName,
        rs.weight,
        rs.is_required as isRequired,
        rs.skill_category as skillCategory
      FROM role_skills rs
      ORDER BY rs.role_id, rs.weight DESC
    `)
    
    // Get role questions for each role
    console.log('📋 Fetching role questions...')
    const questionsResult = await pool.request().query(`
      SELECT 
        rq.role_id as roleId,
        rq.question_text as questionText,
        rq.weight,
        rq.category
      FROM role_questions rq
      WHERE rq.is_active = 1
      ORDER BY rq.role_id, rq.weight DESC
    `)
    
    // Get evaluation sessions count per user
    console.log('📋 Fetching evaluation statistics...')
    const evalStatsResult = await pool.request().query(`
      SELECT 
        u.email,
        COUNT(es.id) as totalEvaluations,
        COUNT(CASE WHEN es.status = 'completed' THEN 1 END) as completedEvaluations,
        COUNT(CASE WHEN es.status = 'processing' THEN 1 END) as processingEvaluations,
        COUNT(CASE WHEN es.status = 'draft' THEN 1 END) as draftEvaluations
      FROM users u
      LEFT JOIN evaluation_sessions es ON u.id = es.user_id
      GROUP BY u.id, u.email
      ORDER BY totalEvaluations DESC
    `)
    
    // Organize skills and questions by role
    const roleSkills: { [key: string]: any[] } = {}
    const roleQuestions: { [key: string]: any[] } = {}
    
    skillsResult.recordset.forEach((skill: any) => {
      if (!roleSkills[skill.roleId]) {
        roleSkills[skill.roleId] = []
      }
      roleSkills[skill.roleId].push({
        skillName: skill.skillName,
        weight: skill.weight,
        isRequired: skill.isRequired,
        skillCategory: skill.skillCategory
      })
    })
    
    questionsResult.recordset.forEach((question: any) => {
      if (!roleQuestions[question.roleId]) {
        roleQuestions[question.roleId] = []
      }
      roleQuestions[question.roleId].push({
        questionText: question.questionText,
        weight: question.weight,
        category: question.category
      })
    })
    
    // Add skills and questions to roles
    const enrichedRoles = rolesResult.recordset.map((role: any) => ({
      ...role,
      skills: roleSkills[role.id] || [],
      questions: roleQuestions[role.id] || [],
      skillsCount: (roleSkills[role.id] || []).length,
      questionsCount: (roleQuestions[role.id] || []).length
    }))
    
    // Create evaluation stats lookup
    const evalStatsLookup: { [key: string]: any } = {}
    evalStatsResult.recordset.forEach((stat: any) => {
      evalStatsLookup[stat.email] = {
        totalEvaluations: stat.totalEvaluations,
        completedEvaluations: stat.completedEvaluations,
        processingEvaluations: stat.processingEvaluations,
        draftEvaluations: stat.draftEvaluations
      }
    })
    
    // Add evaluation stats to users
    const enrichedUsers = usersResult.recordset.map((user: any) => ({
      ...user,
      evaluationStats: evalStatsLookup[user.email] || {
        totalEvaluations: 0,
        completedEvaluations: 0,
        processingEvaluations: 0,
        draftEvaluations: 0
      }
    }))
    
    const summary = {
      totalUsers: usersResult.recordset.length,
      activeUsers: usersResult.recordset.filter((u: any) => u.isActive).length,
      totalRoles: rolesResult.recordset.length,
      activeRoles: rolesResult.recordset.filter((r: any) => r.isActive).length,
      totalSkills: skillsResult.recordset.length,
      totalQuestions: questionsResult.recordset.length
    }
    
    return NextResponse.json({
      success: true,
      summary,
      users: enrichedUsers,
      roles: enrichedRoles,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Database query error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  } finally {
    if (pool) {
      await pool.close()
    }
  }
}