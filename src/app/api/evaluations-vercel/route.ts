import { NextRequest, NextResponse } from 'next/server'
import { getVercelDbConnection, executeVercelQuery, vercelDbHealthCheck } from '@/lib/db-vercel'

// Test user ID for evaluation testing
const TEST_USER_ID = '5A5D9AC4-48BB-4117-89F2-5B1D8FC383B8'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  console.log('🚀 VERCEL EVALUATION: Starting GET request...')
  
  try {
    // Step 1: Health check
    const health = await vercelDbHealthCheck()
    
    if (!health.connected) {
      console.error('❌ Database health check failed:', health.error)
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        details: health.error,
        recommendation: 'Check database configuration and network connectivity',
        responseTime: Date.now() - startTime
      }, { status: 503 })
    }
    
    console.log('✅ Database healthy:', health.poolInfo)
    
    // Step 2: Check if tables exist
    try {
      const tableCheck = await executeVercelQuery(`
        SELECT COUNT(*) as count 
        FROM sysobjects 
        WHERE name = 'evaluation_sessions' AND xtype = 'U'
      `)
      
      if (tableCheck.recordset[0].count === 0) {
        console.log('⚠️ evaluation_sessions table does not exist')
        return NextResponse.json({
          success: false,
          error: 'Evaluation system not initialized',
          message: 'Required tables are missing. Please deploy the database schema.',
          deployEndpoint: '/api/deploy-evaluation-final',
          responseTime: Date.now() - startTime
        }, { status: 503 })
      }
    } catch (tableError) {
      console.error('❌ Table check failed:', tableError)
      return NextResponse.json({
        success: false,
        error: 'Unable to verify database schema',
        details: tableError instanceof Error ? tableError.message : 'Unknown error',
        responseTime: Date.now() - startTime
      }, { status: 500 })
    }
    
    // Step 3: Get evaluations
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    try {
      const result = await executeVercelQuery(`
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
          es.status,
          es.average_score as averageScore
        FROM evaluation_sessions es
        LEFT JOIN roles r ON es.role_id = r.id
        WHERE es.user_id = @userId
        ORDER BY es.created_at DESC
        OFFSET @offset ROWS
      `, {
        userId: TEST_USER_ID,
        limit,
        offset
      })
      
      const totalResult = await executeVercelQuery(`
        SELECT COUNT(*) as total 
        FROM evaluation_sessions 
        WHERE user_id = @userId
      `, {
        userId: TEST_USER_ID
      })
      
      const evaluations = result.recordset.map((row: any) => ({
        id: row.id,
        name: row.name || 'Unnamed Evaluation',
        roleId: row.roleId,
        roleTitle: row.roleTitle || 'Unknown Role',
        status: row.status || 'pending',
        totalFiles: row.totalFiles || 0,
        processedFiles: row.processedFiles || 0,
        failedFiles: row.failedFiles || 0,
        createdAt: row.createdAt,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        averageScore: row.averageScore ? parseFloat(row.averageScore) : undefined
      }))
      
      const total = totalResult.recordset[0]?.total || 0
      
      console.log(`✅ Retrieved ${evaluations.length} evaluations`)
      
      return NextResponse.json({
        success: true,
        data: evaluations,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + limit < total,
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(total / limit)
        },
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      })
      
    } catch (queryError) {
      console.error('❌ Query failed:', queryError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch evaluations',
        details: queryError instanceof Error ? queryError.message : 'Unknown error',
        responseTime: Date.now() - startTime
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  console.log('🚀 VERCEL EVALUATION: Starting POST request...')
  
  try {
    // Parse request body
    const body = await request.json()
    const { name, roleId } = body
    
    console.log('📝 Creating evaluation:', { name, roleId })
    
    if (!name || !roleId) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        message: 'Both name and roleId are required',
        provided: { name: !!name, roleId: !!roleId },
        responseTime: Date.now() - startTime
      }, { status: 400 })
    }
    
    // Health check
    const health = await vercelDbHealthCheck()
    
    if (!health.connected) {
      console.error('❌ Database unhealthy:', health.error)
      return NextResponse.json({
        success: false,
        error: 'Database unavailable',
        details: health.error,
        responseTime: Date.now() - startTime
      }, { status: 503 })
    }
    
    // Verify role exists
    try {
      const roleCheck = await executeVercelQuery(`
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
      const evaluationId = crypto.randomUUID()
      
      // Create evaluation
      await executeVercelQuery(`
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
        userId: TEST_USER_ID,
        roleId,
        name
      })
      
      const evaluation = {
        id: evaluationId,
        name,
        roleId,
        roleTitle: role.title,
        status: 'pending',
        totalFiles: 0,
        processedFiles: 0,
        failedFiles: 0,
        createdAt: new Date(),
        startedAt: new Date()
      }
      
      console.log(`✅ Created evaluation: ${evaluationId}`)
      
      return NextResponse.json({
        success: true,
        data: evaluation,
        message: 'Evaluation created successfully',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      })
      
    } catch (dbError) {
      console.error('❌ Database operation failed:', dbError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create evaluation',
        details: dbError instanceof Error ? dbError.message : 'Unknown error',
        responseTime: Date.now() - startTime
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 500 })
  }
}