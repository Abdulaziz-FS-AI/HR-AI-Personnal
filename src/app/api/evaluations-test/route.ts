import { NextRequest, NextResponse } from 'next/server'
import { bulletproofDb, executeQuerySafely } from '@/lib/db-bulletproof'
import sql from 'mssql'

// BULLETPROOF Test endpoints with comprehensive error handling

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🔍 BULLETPROOF TEST: Starting evaluations test...')
    
    // Use test user ID
    const testUserId = '5A5D9AC4-48BB-4117-89F2-5B1D8FC383B8'
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Step 1: Database health check with auto-recovery
    const dbHealth = await bulletproofDb.healthCheck()
    if (!dbHealth.connected) {
      console.log('🔄 Database unhealthy, attempting recovery...')
      await bulletproofDb.gracefulShutdown()
      
      const retryHealth = await bulletproofDb.healthCheck()
      if (!retryHealth.connected) {
        return NextResponse.json({
          success: false,
          error: 'Database connection failed after recovery attempt',
          healthCheck: retryHealth,
          responseTime: Date.now() - startTime
        }, { status: 503 })
      }
    }

    console.log(`✅ Database healthy: Pool=${dbHealth.poolSize}, Total=${dbHealth.totalConnections}`)

    // Step 2: Verify essential tables exist
    const tableCheck = await executeQuerySafely(`
      SELECT name FROM sysobjects 
      WHERE name IN ('evaluation_sessions', 'roles', 'users') AND xtype='U'
    `)

    const existingTables = tableCheck.recordset.map((row: any) => row.name)
    const requiredTables = ['evaluation_sessions', 'roles', 'users']
    const missingTables = requiredTables.filter(table => !existingTables.includes(table))

    if (missingTables.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Required tables missing',
        missingTables,
        existingTables,
        autoFix: 'POST /api/system-recovery',
        responseTime: Date.now() - startTime
      }, { status: 503 })
    }

    // Step 3: Query evaluations using bulletproof method
    const result = await executeQuerySafely(`
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
    `, {
      userId: testUserId,
      limit,
      offset
    })
    
    const totalResult = await executeQuerySafely(`
      SELECT COUNT(*) as total 
      FROM evaluation_sessions 
      WHERE user_id = @userId
    `, {
      userId: testUserId
    })
    
    // Map to frontend interface with bulletproof error handling
    const mappedEvaluations = result.recordset.map((row: any) => ({
      id: row.id,
      name: row.name || 'Unnamed Evaluation',
      roleId: row.roleId,
      roleTitle: row.roleTitle || 'Unknown Role',
      status: row.status || 'pending',
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      totalFiles: row.totalFiles || 0,
      processedFiles: row.processedFiles || 0,
      failedFiles: row.failedFiles || 0,
      averageScore: row.averageScore ? parseFloat(row.averageScore) : undefined,
      topCandidates: 0
    }))
    
    const total = totalResult.recordset[0]?.total || 0

    console.log(`✅ BULLETPROOF TEST: Retrieved ${mappedEvaluations.length} evaluations successfully`)

    return NextResponse.json({
      success: true,
      data: mappedEvaluations,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit)
      },
      performance: {
        responseTime: Date.now() - startTime,
        dbHealth: {
          connected: dbHealth.connected,
          poolSize: dbHealth.poolSize,
          totalConnections: dbHealth.totalConnections
        }
      },
      bulletproof: true,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ BULLETPROOF TEST: Get evaluations error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch evaluations',
      message: error instanceof Error ? error.message : 'Unknown error',
      bulletproof: true,
      debug: {
        error: error instanceof Error ? error.stack : String(error),
        responseTime: Date.now() - startTime
      },
      recovery: 'POST /api/system-recovery'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🚀 BULLETPROOF TEST: Creating evaluation...')
    
    // Use test user ID
    const testUserId = '5A5D9AC4-48BB-4117-89F2-5B1D8FC383B8'
    
    const body = await request.json()
    const { name, roleId } = body

    if (!name || !roleId) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        message: 'Both name and roleId are required',
        provided: { name: !!name, roleId: !!roleId },
        responseTime: Date.now() - startTime
      }, { status: 400 })
    }

    // Database health check
    const dbHealth = await bulletproofDb.healthCheck()
    if (!dbHealth.connected) {
      return NextResponse.json({
        success: false,
        error: 'Database unavailable',
        healthCheck: dbHealth,
        responseTime: Date.now() - startTime
      }, { status: 503 })
    }

    // Verify role exists
    const roleCheck = await executeQuerySafely(`
      SELECT id, title FROM roles WHERE id = @roleId
    `, { roleId })

    if (roleCheck.recordset.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid role',
        message: 'The specified role does not exist',
        roleId,
        responseTime: Date.now() - startTime
      }, { status: 404 })
    }

    const role = roleCheck.recordset[0]
    
    // Generate proper UNIQUEIDENTIFIER
    const evaluationId = crypto.randomUUID()
    
    // Insert with bulletproof method
    await executeQuerySafely(`
      INSERT INTO evaluation_sessions (
        id, user_id, role_id, name, 
        total_files, processed_files, failed_files, 
        status, created_at, started_at, updated_at
      )
      VALUES (
        @evaluationId, @userId, @roleId, @name,
        0, 0, 0, 
        'pending', GETDATE(), GETDATE(), GETDATE()
      )
    `, {
      evaluationId,
      userId: testUserId,
      roleId,
      name
    })
    
    const evaluation = { 
      id: evaluationId,
      name, 
      userId: testUserId,
      roleId,
      roleTitle: role.title,
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      createdAt: new Date(),
      startedAt: new Date(),
      status: 'pending'
    }

    console.log(`✅ BULLETPROOF TEST: Created evaluation ${evaluationId}`)

    return NextResponse.json({
      success: true,
      data: evaluation,
      bulletproof: true,
      performance: {
        responseTime: Date.now() - startTime
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ BULLETPROOF TEST: Create evaluation error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to create evaluation',
      message: error instanceof Error ? error.message : 'Unknown error',
      bulletproof: true,
      debug: {
        error: error instanceof Error ? error.stack : String(error),
        responseTime: Date.now() - startTime
      },
      recovery: 'POST /api/system-recovery'
    }, { status: 500 })
  }
}