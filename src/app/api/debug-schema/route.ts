import { NextRequest, NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db-config'
import { withDebugAuth, withDebugRateLimit } from '@/lib/security/debug-auth'
import { withErrorHandler } from '@/lib/api/error-handler'

async function debugSchemaHandler(request: NextRequest) {
  try {
    const pool = await getDbConnection()
    
    const results = []
    
    // Check if users table exists before creation
    const beforeUsers = await pool.request().query(`
      SELECT COUNT(*) as count FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type in (N'U')
    `)
    results.push({ step: 'before_users', count: beforeUsers.recordset[0].count })
    
    // Try to create users table with detailed logging
    const createUsersSQL = `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type in (N'U'))
      BEGIN
        CREATE TABLE users (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          email NVARCHAR(255) NOT NULL,
          password_hash NVARCHAR(255) NOT NULL,
          first_name NVARCHAR(100),
          last_name NVARCHAR(100),
          company_name NVARCHAR(200),
          phone NVARCHAR(20),
          is_active BIT DEFAULT 1,
          credits_remaining INT DEFAULT 1000,
          subscription_tier NVARCHAR(50) DEFAULT 'free',
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE(),
          last_login DATETIME2
        )
      END
    `
    
    await pool.request().query(createUsersSQL)
    results.push({ step: 'create_users', status: 'executed' })
    
    // Check if users table exists after creation
    const afterUsers = await pool.request().query(`
      SELECT COUNT(*) as count FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type in (N'U')
    `)
    results.push({ step: 'after_users', count: afterUsers.recordset[0].count })
    
    // List all tables
    const allTables = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE_TABLE'
      ORDER BY TABLE_NAME
    `)
    results.push({ step: 'all_tables', tables: allTables.recordset.map(r => r.TABLE_NAME) })
    
    // Try simpler approach - create table without IF NOT EXISTS
    try {
      await pool.request().query(`
        CREATE TABLE simple_test (
          id int PRIMARY KEY,
          name nvarchar(50)
        )
      `)
      results.push({ step: 'simple_create', status: 'success' })
    } catch (err) {
      results.push({ step: 'simple_create', status: 'error', error: err instanceof Error ? err.message : 'unknown' })
    }
    
    // Check tables again
    const finalTables = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE_TABLE'
      ORDER BY TABLE_NAME
    `)
    results.push({ step: 'final_tables', tables: finalTables.recordset.map(r => r.TABLE_NAME) })
    
    await pool.close()
    
    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Debug schema error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Export secured version of the endpoint
export const POST = withErrorHandler(
  withDebugRateLimit(
    withDebugAuth(debugSchemaHandler)
  )
)