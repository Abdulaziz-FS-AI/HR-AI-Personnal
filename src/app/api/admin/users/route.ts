import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db-utils"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const offset = (page - 1) * limit

    const users = await executeQuery(async (pool) => {
      let whereClause = ''
      const request = pool.request()
        .input('limit', limit)
        .input('offset', offset)

      if (search) {
        whereClause = 'WHERE u.email LIKE @search OR u.company_name LIKE @search'
        request.input('search', `%${search}%`)
      }

      const result = await request.query(`
        SELECT 
          u.id,
          u.email,
          u.company_name,
          u.first_name,
          u.last_name,
          u.subscription_tier,
          u.credits_remaining,
          u.created_at,
          u.last_login,
          COUNT(DISTINCT r.id) as roleCount,
          COUNT(DISTINCT es.id) as evaluationCount,
          COUNT(DISTINCT ef.id) as totalFilesUploaded,
          AVG(CASE WHEN er.overall_score IS NOT NULL THEN er.overall_score END) as avgScore
        FROM users u
        LEFT JOIN roles r ON u.id = r.user_id AND r.is_active = 1
        LEFT JOIN evaluation_sessions es ON u.id = es.user_id
        LEFT JOIN evaluation_files ef ON es.id = ef.session_id
        LEFT JOIN evaluation_results er ON ef.id = er.file_id
        ${whereClause}
        GROUP BY u.id, u.email, u.company_name, u.first_name, u.last_name, 
                 u.subscription_tier, u.credits_remaining, u.created_at, u.last_login
        ORDER BY u.created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `)

      // Get total count for pagination
      const countResult = await pool.request()
        .input('search', search ? `%${search}%` : '')
        .query(`
          SELECT COUNT(*) as total
          FROM users u
          ${search ? 'WHERE u.email LIKE @search OR u.company_name LIKE @search' : ''}
        `)

      return {
        users: result.recordset,
        total: countResult.recordset[0].total,
        page,
        limit,
        totalPages: Math.ceil(countResult.recordset[0].total / limit)
      }
    })

    return NextResponse.json({
      success: true,
      data: users
    })

  } catch (error) {
    console.error('Users fetch error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    )
  }
}