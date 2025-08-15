/**
 * THE ULTIMATE EVALUATION ENDPOINT
 * 
 * This is the SINGLE SOURCE OF TRUTH for evaluations.
 * It handles all constraint issues, environment variables, and edge cases.
 * 
 * STOP CREATING NEW EVALUATION ENDPOINTS. USE THIS ONE.
 */

import { NextRequest, NextResponse } from 'next/server'
import sql from 'mssql'
import { getDatabaseConfig } from '@/lib/db-config-vercel'
import { resolveUserContext } from '@/lib/auth/user-resolver'

// Global connection pool for serverless
let globalPool: sql.ConnectionPool | undefined

async function getConnection(): Promise<sql.ConnectionPool> {
  if (globalPool?.connected) {
    return globalPool
  }

  // Get config with multiple naming convention support
  const dbConfig = getDatabaseConfig()
  
  if (!dbConfig.server || !dbConfig.database || !dbConfig.user || !dbConfig.password) {
    throw new Error('Database configuration missing. Check environment variables.')
  }

  const config: sql.config = {
    server: dbConfig.server,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true
    },
    pool: {
      max: 3,
      min: 0,
      idleTimeoutMillis: 10000
    }
  }

  try {
    const pool = new sql.ConnectionPool(config)
    await pool.connect()
    globalPool = pool
    return pool
  } catch (error) {
    globalPool = undefined
    throw error
  }
}

// Ensure database schema is correct
async function ensureSchema(pool: sql.ConnectionPool) {
  try {
    // Create table if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_sessions' AND xtype='U')
      CREATE TABLE evaluation_sessions (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        role_id UNIQUEIDENTIFIER NOT NULL,
        name NVARCHAR(200) NOT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'draft',
        total_files INT NOT NULL DEFAULT 0,
        processed_files INT NOT NULL DEFAULT 0,
        failed_files INT NOT NULL DEFAULT 0,
        average_score DECIMAL(5,2) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        started_at DATETIME2 NULL,
        completed_at DATETIME2 NULL,
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
      )
    `)

    // Drop any existing constraints on status
    const constraints = await pool.request().query(`
      SELECT o.name
      FROM sys.check_constraints c
      JOIN sys.objects o ON c.object_id = o.object_id
      WHERE o.parent_object_id = OBJECT_ID('evaluation_sessions')
        AND c.definition LIKE '%status%'
    `)

    for (const constraint of constraints.recordset) {
      await pool.request().query(`
        ALTER TABLE evaluation_sessions DROP CONSTRAINT ${constraint.name}
      `)
    }

    // Add the correct constraint
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.check_constraints 
        WHERE name = 'CK_evaluation_status_ultimate'
      )
      ALTER TABLE evaluation_sessions
      ADD CONSTRAINT CK_evaluation_status_ultimate
      CHECK (status IN ('draft', 'pending', 'processing', 'completed', 'failed', 'cancelled'))
    `)

    return true
  } catch (error) {
    console.error('Schema setup error:', error)
    return false
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const pool = await getConnection()
    
    // Ensure schema is correct
    await ensureSchema(pool)
    
    // Get authenticated user or fallback to test user in development
    const userContext = await resolveUserContext(request)
    const userId = userContext.userId
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, userId)
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query(`
        SELECT 
          es.id,
          es.name,
          es.role_id as roleId,
          r.title as roleTitle,
          es.status,
          es.total_files as totalFiles,
          es.processed_files as processedFiles,
          es.failed_files as failedFiles,
          es.average_score as averageScore,
          es.created_at as createdAt,
          es.started_at as startedAt,
          es.completed_at as completedAt
        FROM evaluation_sessions es
        LEFT JOIN roles r ON es.role_id = r.id
        WHERE es.user_id = @userId
        ORDER BY es.created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `)
    
    const totalResult = await pool.request()
      .input('userId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT COUNT(*) as total 
        FROM evaluation_sessions 
        WHERE user_id = @userId
      `)
    
    return NextResponse.json({
      success: true,
      data: result.recordset.map(row => ({
        ...row,
        averageScore: row.averageScore ? parseFloat(row.averageScore) : null
      })),
      pagination: {
        limit,
        offset,
        total: totalResult.recordset[0].total,
        hasMore: offset + limit < totalResult.recordset[0].total
      },
      responseTime: Date.now() - startTime
    })
    
  } catch (error) {
    console.error('GET error:', error)
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
  
  try {
    const body = await request.json()
    const { name, roleId, roleTitle, files } = body
    
    if (!name || !roleId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields',
        required: ['name', 'roleId']
      }, { status: 400 })
    }
    
    const pool = await getConnection()
    
    // Ensure schema is correct
    await ensureSchema(pool)
    
    // Get authenticated user or fallback to test user in development
    const userContext = await resolveUserContext(request)
    const userId = userContext.userId
    const evaluationId = crypto.randomUUID()
    
    // Create evaluation with 'draft' status (always valid)
    await pool.request()
      .input('id', sql.UniqueIdentifier, evaluationId)
      .input('userId', sql.UniqueIdentifier, userId)
      .input('roleId', sql.UniqueIdentifier, roleId)
      .input('name', sql.NVarChar, name)
      .input('totalFiles', sql.Int, files?.length || 0)
      .query(`
        INSERT INTO evaluation_sessions (
          id, user_id, role_id, name, 
          total_files, processed_files, failed_files, 
          status, created_at, updated_at
        )
        VALUES (
          @id, @userId, @roleId, @name,
          @totalFiles, 0, 0, 
          'draft', GETDATE(), GETDATE()
        )
      `)
    
    // If we have files, update status to pending
    if (files && files.length > 0) {
      await pool.request()
        .input('id', sql.UniqueIdentifier, evaluationId)
        .query(`
          UPDATE evaluation_sessions 
          SET status = 'pending', started_at = GETDATE()
          WHERE id = @id
        `)
    }
    
    const evaluation = {
      id: evaluationId,
      name,
      userId: userId,
      roleId,
      roleTitle: roleTitle || 'Unknown Role',
      status: files?.length > 0 ? 'pending' : 'draft',
      totalFiles: files?.length || 0,
      processedFiles: 0,
      failedFiles: 0,
      createdAt: new Date()
    }
    
    console.log(`✅ Created evaluation: ${evaluationId}`)
    
    return NextResponse.json({
      success: true,
      data: evaluation,
      message: 'Evaluation created successfully',
      responseTime: Date.now() - startTime
    })
    
  } catch (error) {
    console.error('POST error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create evaluation',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 500 })
  }
}

// DELETE endpoint to clean up test data
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const evaluationId = searchParams.get('id')
    
    if (!evaluationId) {
      return NextResponse.json({
        success: false,
        error: 'Missing evaluation ID'
      }, { status: 400 })
    }
    
    const pool = await getConnection()
    
    await pool.request()
      .input('id', sql.UniqueIdentifier, evaluationId)
      .query(`DELETE FROM evaluation_sessions WHERE id = @id`)
    
    return NextResponse.json({
      success: true,
      message: 'Evaluation deleted'
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}