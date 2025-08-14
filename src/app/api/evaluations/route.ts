import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createBatchSession, getBatchSession, type BatchProcessingSession } from '@/lib/db-batch'
import { getDbConnection } from '@/lib/db-config'
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

    // Get batch sessions for this user
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, session.user.id)
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query(`
        SELECT TOP (@limit) 
          session_id as id,
          session_id,
          role_id,
          total_files,
          processed_files,
          failed_files,
          started_at,
          completed_at,
          status
        FROM batch_sessions 
        WHERE user_id = @userId
        ORDER BY started_at DESC
        OFFSET @offset ROWS
      `)
    
    const totalResult = await pool.request()
      .input('userId', sql.UniqueIdentifier, session.user.id)
      .query('SELECT COUNT(*) as total FROM batch_sessions WHERE user_id = @userId')
    
    const evaluations = {
      data: result.recordset,
      total: totalResult.recordset[0].total
    }

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

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const batchSession: BatchProcessingSession = {
      sessionId,
      userId: session.user.id,
      roleId,
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      startedAt: new Date(),
      status: 'pending'
    }
    
    await createBatchSession(batchSession)
    const evaluation = { id: sessionId, name, ...batchSession }

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