import { NextResponse } from 'next/server'
import sql from 'mssql'
import { getDbConnection } from '@/lib/db'

export async function GET() {
  let pool: sql.ConnectionPool | null = null
  
  try {
    console.log('🧪 Testing database connection...')
    pool = await getDbConnection()
    
    // Test basic query
    const result = await pool.request().query('SELECT COUNT(*) as count FROM users')
    const userCount = result.recordset[0].count
    
    // Test evaluation_sessions table with updated_at
    const evalTest = await pool.request().query(`
      SELECT TOP 1 
        id, 
        name, 
        created_at, 
        updated_at,
        status
      FROM evaluation_sessions
    `)
    
    // Test getUserEvaluations logic
    const testUserId = '74C57065-8A1B-4175-B3B8-88AD2DDB79AC'
    const getUserEvalsTest = await pool.request()
      .input('userId', sql.UniqueIdentifier, testUserId)
      .input('limit', sql.Int, 50)
      .input('offset', sql.Int, 0)
      .query(`
        SELECT 
          es.id,
          es.user_id as userId,
          es.role_id as roleId,
          es.name,
          es.status,
          es.total_files as totalFiles,
          es.processed_files as processedFiles,
          es.created_at as createdAt,
          es.updated_at as updatedAt,
          es.completed_at as completedAt,
          r.title as roleTitle
        FROM evaluation_sessions es
        LEFT JOIN roles r ON es.role_id = r.id
        WHERE es.user_id = @userId
        ORDER BY es.created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `)
    
    return NextResponse.json({
      success: true,
      message: 'Database test successful',
      data: {
        userCount,
        evaluationSessions: evalTest.recordset.length,
        getUserEvalsQuery: 'SUCCESS',
        getUserEvalsCount: getUserEvalsTest.recordset.length,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('Database test error:', error)
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