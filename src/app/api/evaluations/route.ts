import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDbConnection } from '@/lib/db'
import sql from 'mssql'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const roleId = searchParams.get('roleId') || undefined
    const status = searchParams.get('status') || undefined

    // Get evaluation sessions for this user
    const pool = await getDbConnection()
    
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, session.user.id)
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query(`
        SELECT TOP (@limit) 
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
          es.status
        FROM evaluation_sessions es
        LEFT JOIN roles r ON es.role_id = r.id
        WHERE es.user_id = @userId
        ORDER BY es.created_at DESC
        OFFSET @offset ROWS
      `)
    
    const totalResult = await pool.request()
      .input('userId', sql.UniqueIdentifier, session.user.id)
      .query('SELECT COUNT(*) as total FROM evaluation_sessions WHERE user_id = @userId')
    
    // Map backend data to frontend interface
    const mappedEvaluations = result.recordset.map((row: any) => ({
      id: row.id,
      name: row.name,
      roleId: row.roleId,
      roleTitle: row.roleTitle || 'Unknown Role',
      status: row.status || 'pending',
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      totalFiles: row.totalFiles || 0,
      processedFiles: row.processedFiles || 0,
      failedFiles: row.failedFiles || 0,
      averageScore: row.averageScore,
      topCandidates: 0 // Calculate from results if needed
    }))
    
    const evaluations = {
      data: mappedEvaluations,
      total: totalResult.recordset[0].total
    }
    
    await pool.close()

    return NextResponse.json({
      success: true,
      data: evaluations.data,
      pagination: {
        limit,
        offset,
        total: evaluations.total,
        hasMore: offset + limit < evaluations.total
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
  let pool: sql.ConnectionPool | null = null
  
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, roleId } = body

    if (!name || !roleId) {
      return NextResponse.json(
        { error: 'Name and roleId are required' },
        { status: 400 }
      )
    }

    pool = await getDbConnection()

    // Check if evaluation_sessions table exists
    const tableCheck = await pool.request().query(`
      SELECT name FROM sysobjects 
      WHERE name='evaluation_sessions' AND xtype='U'
    `)
    
    if (tableCheck.recordset.length === 0) {
      return NextResponse.json(
        { 
          error: 'Evaluation system not initialized',
          message: 'Please deploy the evaluation system schema first',
          action: 'Run POST /api/deploy-evaluation-system'
        },
        { status: 503 }
      )
    }
    
    // Generate a proper UNIQUEIDENTIFIER
    const evaluationId = crypto.randomUUID()
    
    // Insert into evaluation_sessions table
    await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .input('userId', sql.UniqueIdentifier, session.user.id)
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
          'pending', GETDATE(), GETDATE()
        )
      `)
    
    await pool.close()
    
    const evaluation = { 
      id: evaluationId,
      name, 
      userId: session.user.id,
      roleId,
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      createdAt: new Date(),
      startedAt: new Date(),
      status: 'pending'
    }

    return NextResponse.json({
      success: true,
      data: evaluation,
      message: 'Evaluation session created successfully'
    })
  } catch (error) {
    console.error('Create evaluation error:', error)
    
    if (pool) {
      await pool.close()
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create evaluation',
        message: error instanceof Error ? error.message : 'Unknown database error'
      },
      { status: 500 }
    )
  }
}