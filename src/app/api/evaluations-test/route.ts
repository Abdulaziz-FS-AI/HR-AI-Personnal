import { NextRequest, NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'
import sql from 'mssql'

// Test endpoints without authentication for development

export async function GET(request: NextRequest) {
  try {
    // Use test user ID
    // Use actual test user ID from database
    const testUserId = '5A5D9AC4-48BB-4117-89F2-5B1D8FC383B8'
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const pool = await getDbConnection()
    
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, testUserId)
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query(`
        SELECT 
          es.id,
          es.name,
          es.role_id as roleId,
          r.title as roleTitle,
          es.total_files as totalFiles,
          es.processed_files as processedFiles,
          es.failed_files as failedFiles,
          es.created_at as createdAt,
          es.started_at as startedAt,
          es.completed_at as completedAt,
          es.status,
          es.average_score as averageScore
        FROM evaluation_sessions es
        LEFT JOIN roles r ON es.role_id = r.id
        WHERE es.user_id = @userId
        ORDER BY es.created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `)
    
    const totalResult = await pool.request()
      .input('userId', sql.UniqueIdentifier, testUserId)
      .query('SELECT COUNT(*) as total FROM evaluation_sessions WHERE user_id = @userId')
    
    // Map to frontend interface
    const mappedEvaluations = result.recordset.map((row: any) => ({
      id: row.id,
      name: row.name,
      roleId: row.roleId,
      roleTitle: row.roleTitle || 'Unknown Role',
      status: row.status || 'draft',
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      totalFiles: row.totalFiles || 0,
      processedFiles: row.processedFiles || 0,
      failedFiles: row.failedFiles || 0,
      averageScore: row.averageScore,
      topCandidates: 0
    }))
    
    await pool.close()

    return NextResponse.json({
      success: true,
      data: mappedEvaluations,
      pagination: {
        limit,
        offset,
        total: totalResult.recordset[0].total,
        hasMore: offset + limit < totalResult.recordset[0].total
      }
    })
  } catch (error) {
    console.error('Get evaluations error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch evaluations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Use test user ID
    // Use actual test user ID from database
    const testUserId = '5A5D9AC4-48BB-4117-89F2-5B1D8FC383B8'
    
    const body = await request.json()
    const { name, roleId } = body

    if (!name || !roleId) {
      return NextResponse.json(
        { error: 'Name and roleId are required' },
        { status: 400 }
      )
    }

    const pool = await getDbConnection()
    
    // Generate a proper UNIQUEIDENTIFIER
    const evaluationId = crypto.randomUUID()
    
    // Insert into evaluation_sessions table
    await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .input('userId', sql.UniqueIdentifier, testUserId)
      .input('roleId', sql.UniqueIdentifier, roleId)
      .input('name', sql.NVarChar, name)
      .query(`
        INSERT INTO evaluation_sessions (
          id, user_id, role_id, name, 
          total_files, processed_files, failed_files, 
          status, created_at, started_at
        )
        VALUES (
          @evaluationId, @userId, @roleId, @name,
          0, 0, 0, 
          'draft', GETDATE(), GETDATE()
        )
      `)
    
    await pool.close()
    
    const evaluation = { 
      id: evaluationId,
      name, 
      userId: testUserId,
      roleId,
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      createdAt: new Date(),
      startedAt: new Date(),
      status: 'draft'
    }

    return NextResponse.json({
      success: true,
      data: evaluation
    })
  } catch (error) {
    console.error('Create evaluation error:', error)
    return NextResponse.json(
      { error: 'Failed to create evaluation' },
      { status: 500 }
    )
  }
}