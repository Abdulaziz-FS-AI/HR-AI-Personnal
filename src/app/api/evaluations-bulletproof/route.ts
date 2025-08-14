import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { bulletproofDb, executeQuerySafely } from '@/lib/db-bulletproof'
import sql from 'mssql'

// Ultra-resilient evaluation endpoint with complete error recovery
export const maxDuration = 300 // 5 minutes timeout

interface EvaluationSession {
  id: string
  name: string
  roleId: string
  roleTitle: string
  status: string
  totalFiles: number
  processedFiles: number
  failedFiles: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  averageScore?: number
}

interface SystemHealth {
  database: boolean
  tables: boolean
  permissions: boolean
  recommendations: string[]
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  let healthStatus: SystemHealth = {
    database: false,
    tables: false,
    permissions: false,
    recommendations: []
  }

  try {
    console.log('🚀 Starting bulletproof evaluation request...')
    
    // Step 1: Authenticate with detailed logging
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Authentication required',
          message: 'Please log in to access evaluations',
          healthStatus,
          responseTime: Date.now() - startTime
        },
        { status: 401 }
      )
    }

    console.log(`✅ Authenticated user: ${session.user.email || session.user.id}`)

    // Step 2: Database health check with auto-recovery
    try {
      const dbHealth = await bulletproofDb.healthCheck()
      healthStatus.database = dbHealth.connected
      
      if (!dbHealth.connected) {
        healthStatus.recommendations.push('Database connection failed - attempting recovery')
        
        // Attempt recovery
        console.log('🔄 Database unhealthy, attempting recovery...')
        await bulletproofDb.gracefulShutdown()
        
        // Retry health check after recovery
        const retryHealth = await bulletproofDb.healthCheck()
        healthStatus.database = retryHealth.connected
        
        if (!retryHealth.connected) {
          throw new Error(`Database recovery failed: ${retryHealth.error}`)
        }
        
        console.log('✅ Database recovered successfully')
      }

      console.log(`✅ Database health: Connected (Pool: ${dbHealth.poolSize}, Total: ${dbHealth.totalConnections}, Idle: ${dbHealth.idleConnections})`)

    } catch (dbError) {
      console.error('❌ Database health check failed:', dbError)
      return NextResponse.json(
        {
          success: false,
          error: 'Database connectivity issue',
          message: 'Unable to establish database connection. Please try again in a moment.',
          healthStatus: {
            ...healthStatus,
            recommendations: [
              'Database server may be under heavy load',
              'Check network connectivity',
              'Verify database credentials'
            ]
          },
          responseTime: Date.now() - startTime
        },
        { status: 503 }
      )
    }

    // Step 3: Verify essential tables exist with auto-deployment
    try {
      console.log('🔍 Checking essential tables...')
      
      const requiredTables = ['evaluation_sessions', 'evaluation_files', 'evaluation_results', 'roles', 'users']
      const tableCheck = await executeQuerySafely(`
        SELECT name FROM sysobjects 
        WHERE name IN (${requiredTables.map(t => `'${t}'`).join(',')}) AND xtype='U'
      `)

      const existingTables = tableCheck.recordset.map((row: any) => row.name)
      const missingTables = requiredTables.filter(table => !existingTables.includes(table))

      if (missingTables.length > 0) {
        healthStatus.tables = false
        healthStatus.recommendations.push(`Missing tables: ${missingTables.join(', ')}`)
        
        return NextResponse.json(
          {
            success: false,
            error: 'Evaluation system not initialized',
            message: 'Required database tables are missing. System needs initialization.',
            healthStatus,
            missingTables,
            deploymentInstructions: {
              baseTables: 'POST /api/deploy-basic-schema',
              evaluationTables: 'POST /api/deploy-evaluation-final',
              healthCheck: 'GET /api/evaluation-health'
            },
            responseTime: Date.now() - startTime
          },
          { status: 503 }
        )
      }

      healthStatus.tables = true
      console.log(`✅ All required tables exist: ${existingTables.join(', ')}`)

    } catch (tableError) {
      console.error('❌ Table verification failed:', tableError)
      return NextResponse.json(
        {
          success: false,
          error: 'Table verification failed',
          message: 'Unable to verify database schema. System may need reinitialization.',
          healthStatus: {
            ...healthStatus,
            recommendations: ['Run schema deployment', 'Check database permissions']
          },
          responseTime: Date.now() - startTime
        },
        { status: 503 }
      )
    }

    // Step 4: Get evaluations with bulletproof querying
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100) // Max 100
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)
    const roleId = searchParams.get('roleId') || undefined
    const status = searchParams.get('status') || undefined

    try {
      console.log(`🔍 Querying evaluations (limit: ${limit}, offset: ${offset})...`)

      // Build dynamic query with proper parameterization
      let query = `
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
      `

      const parameters: Record<string, any> = {
        userId: session.user.id,
        limit,
        offset
      }

      // Add optional filters
      if (roleId) {
        query += ' AND es.role_id = @roleId'
        parameters.roleId = roleId
      }
      
      if (status) {
        query += ' AND es.status = @status'
        parameters.status = status
      }

      query += `
        ORDER BY es.created_at DESC
        OFFSET @offset ROWS
      `

      const result = await executeQuerySafely(query, parameters)
      
      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM evaluation_sessions es 
        WHERE es.user_id = @userId
      `
      
      const countParams: Record<string, any> = { userId: session.user.id }
      
      if (roleId) {
        countQuery += ' AND es.role_id = @roleId'
        countParams.roleId = roleId
      }
      
      if (status) {
        countQuery += ' AND es.status = @status'
        countParams.status = status
      }

      const totalResult = await executeQuerySafely(countQuery, countParams)
      const total = totalResult.recordset[0]?.total || 0

      // Map results with proper type safety
      const evaluations: EvaluationSession[] = result.recordset.map((row: any) => ({
        id: row.id,
        name: row.name || 'Unnamed Evaluation',
        roleId: row.roleId,
        roleTitle: row.roleTitle || 'Unknown Role',
        status: row.status || 'unknown',
        totalFiles: row.totalFiles || 0,
        processedFiles: row.processedFiles || 0,
        failedFiles: row.failedFiles || 0,
        createdAt: row.createdAt,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        averageScore: row.averageScore ? parseFloat(row.averageScore) : undefined
      }))

      healthStatus.permissions = true
      
      console.log(`✅ Successfully retrieved ${evaluations.length} evaluations`)

      return NextResponse.json({
        success: true,
        data: evaluations,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + limit < total,
          totalPages: Math.ceil(total / limit),
          currentPage: Math.floor(offset / limit) + 1
        },
        healthStatus,
        performance: {
          responseTime: Date.now() - startTime,
          dbQueries: 2,
          recordsProcessed: evaluations.length
        },
        timestamp: new Date().toISOString()
      })

    } catch (queryError) {
      console.error('❌ Query execution failed:', queryError)
      
      return NextResponse.json(
        {
          success: false,
          error: 'Query execution failed',
          message: 'Unable to retrieve evaluations. Database may be temporarily unavailable.',
          healthStatus: {
            ...healthStatus,
            permissions: false,
            recommendations: [
              'Database query failed - possible permissions issue',
              'Check database connectivity',
              'Verify user permissions on evaluation tables'
            ]
          },
          debug: {
            error: queryError instanceof Error ? queryError.message : 'Unknown query error',
            userId: session.user.id,
            filters: { roleId, status, limit, offset }
          },
          responseTime: Date.now() - startTime
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('❌ Bulletproof evaluation request failed:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again.',
        healthStatus,
        debug: {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        },
        responseTime: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🚀 Creating new evaluation session...')
    
    // Step 1: Authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Authentication required',
          responseTime: Date.now() - startTime
        },
        { status: 401 }
      )
    }

    // Step 2: Validate request body
    const body = await request.json()
    const { name, roleId } = body

    if (!name || !roleId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required fields',
          message: 'Both name and roleId are required',
          provided: { name: !!name, roleId: !!roleId },
          responseTime: Date.now() - startTime
        },
        { status: 400 }
      )
    }

    // Step 3: Database health check
    const dbHealth = await bulletproofDb.healthCheck()
    if (!dbHealth.connected) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database unavailable',
          message: 'Unable to create evaluation session. Please try again.',
          responseTime: Date.now() - startTime
        },
        { status: 503 }
      )
    }

    // Step 4: Verify role exists
    const roleCheck = await executeQuerySafely(`
      SELECT id, title FROM roles 
      WHERE id = @roleId AND user_id = @userId
    `, {
      roleId,
      userId: session.user.id
    })

    if (roleCheck.recordset.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid role',
          message: 'The specified role does not exist or you do not have access to it',
          responseTime: Date.now() - startTime
        },
        { status: 404 }
      )
    }

    const role = roleCheck.recordset[0]

    // Step 5: Create evaluation session
    const evaluationId = crypto.randomUUID()
    
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
      userId: session.user.id,
      roleId,
      name
    })

    const newEvaluation: EvaluationSession = {
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

    console.log(`✅ Created evaluation session: ${evaluationId}`)

    return NextResponse.json({
      success: true,
      data: newEvaluation,
      message: 'Evaluation session created successfully',
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Create evaluation failed:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create evaluation',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        responseTime: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}