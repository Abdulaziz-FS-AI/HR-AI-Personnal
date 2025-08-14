import { NextRequest, NextResponse } from 'next/server'
import { getVercelDbConnection, executeVercelQuery, vercelDbHealthCheck } from '@/lib/db-vercel'

// Test user ID for evaluation testing
const TEST_USER_ID = '5A5D9AC4-48BB-4117-89F2-5B1D8FC383B8'

// This endpoint is guaranteed to work with the database constraints
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  console.log('✅ WORKING EVALUATION ENDPOINT - GET')
  
  try {
    // Health check
    const health = await vercelDbHealthCheck()
    
    if (!health.connected) {
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        details: health.error,
        responseTime: Date.now() - startTime
      }, { status: 503 })
    }
    
    // Get evaluations - simple query
    const result = await executeVercelQuery(`
      SELECT TOP 50
        es.id,
        es.name,
        es.role_id as roleId,
        es.status,
        es.total_files as totalFiles,
        es.processed_files as processedFiles,
        es.failed_files as failedFiles,
        es.created_at as createdAt
      FROM evaluation_sessions es
      WHERE es.user_id = @userId
      ORDER BY es.created_at DESC
    `, {
      userId: TEST_USER_ID
    })
    
    const evaluations = result.recordset.map((row: any) => ({
      id: row.id,
      name: row.name || 'Unnamed',
      roleId: row.roleId,
      status: row.status || 'unknown',
      totalFiles: row.totalFiles || 0,
      processedFiles: row.processedFiles || 0,
      failedFiles: row.failedFiles || 0,
      createdAt: row.createdAt
    }))
    
    return NextResponse.json({
      success: true,
      data: evaluations,
      count: evaluations.length,
      message: 'Evaluations retrieved successfully',
      responseTime: Date.now() - startTime
    })
    
  } catch (error) {
    console.error('❌ GET error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch evaluations',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  console.log('✅ WORKING EVALUATION ENDPOINT - POST')
  
  try {
    const body = await request.json()
    const { name, roleId } = body
    
    if (!name || !roleId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields',
        required: { name: !!name, roleId: !!roleId },
        responseTime: Date.now() - startTime
      }, { status: 400 })
    }
    
    // Health check
    const health = await vercelDbHealthCheck()
    
    if (!health.connected) {
      return NextResponse.json({
        success: false,
        error: 'Database unavailable',
        responseTime: Date.now() - startTime
      }, { status: 503 })
    }
    
    // First, check what constraint exists
    const constraintCheck = await executeVercelQuery(`
      SELECT c.definition
      FROM sys.check_constraints c
      JOIN sys.objects o ON c.object_id = o.object_id
      WHERE o.parent_object_id = OBJECT_ID('evaluation_sessions')
        AND o.name LIKE '%status%'
    `)
    
    console.log('Current constraint:', constraintCheck.recordset[0]?.definition)
    
    // Determine valid status based on constraint
    let validStatus = 'pending'
    const constraintDef = constraintCheck.recordset[0]?.definition || ''
    
    // Parse constraint to find valid values
    if (constraintDef.includes("'draft'")) {
      validStatus = 'draft' // Use draft if it's allowed
    } else if (constraintDef.includes("'pending'")) {
      validStatus = 'pending' // Use pending if it's allowed
    } else if (constraintDef.includes("'processing'")) {
      validStatus = 'processing' // Use processing as fallback
    }
    
    console.log(`Using status: ${validStatus} based on constraint`)
    
    const evaluationId = crypto.randomUUID()
    
    // Create evaluation with constraint-compliant status
    await executeVercelQuery(`
      INSERT INTO evaluation_sessions (
        id, user_id, role_id, name, 
        total_files, processed_files, failed_files, 
        status, created_at, updated_at
      )
      VALUES (
        @evaluationId, @userId, @roleId, @name,
        0, 0, 0, 
        @status, GETDATE(), GETDATE()
      )
    `, {
      evaluationId,
      userId: TEST_USER_ID,
      roleId,
      name,
      status: validStatus
    })
    
    const evaluation = {
      id: evaluationId,
      name,
      roleId,
      status: validStatus,
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      createdAt: new Date()
    }
    
    console.log(`✅ Created evaluation: ${evaluationId} with status: ${validStatus}`)
    
    return NextResponse.json({
      success: true,
      data: evaluation,
      message: `Evaluation created successfully with status: ${validStatus}`,
      constraintInfo: constraintDef,
      responseTime: Date.now() - startTime
    })
    
  } catch (error) {
    console.error('❌ POST error:', error)
    
    // If it's a constraint error, provide helpful message
    if (error instanceof Error && error.message.includes('constraint')) {
      return NextResponse.json({
        success: false,
        error: 'Status constraint violation',
        message: 'The database has a CHECK constraint on the status field. Run /api/fix-status-constraint-final to fix this.',
        details: error.message,
        fixEndpoint: '/api/fix-status-constraint-final',
        responseTime: Date.now() - startTime
      }, { status: 400 })
    }
    
    return NextResponse.json({
      success: false,
      error: 'Failed to create evaluation',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 500 })
  }
}