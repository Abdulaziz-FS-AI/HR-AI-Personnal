import { NextRequest, NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db-config'

export async function GET() {
  try {
    const pool = await getDbConnection()
    
    // First create batch_sessions table if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[batch_sessions]') AND type in (N'U'))
      BEGIN
        CREATE TABLE batch_sessions (
          session_id NVARCHAR(100) PRIMARY KEY,
          user_id UNIQUEIDENTIFIER NOT NULL,
          role_id UNIQUEIDENTIFIER NOT NULL,
          total_files INT DEFAULT 0,
          processed_files INT DEFAULT 0,
          failed_files INT DEFAULT 0,
          started_at DATETIME2 DEFAULT GETDATE(),
          completed_at DATETIME2,
          status NVARCHAR(50) DEFAULT 'pending'
        )
      END
    `)
    
    // Try to query the table
    const result = await pool.request().query(`
      SELECT TOP 10
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
      ORDER BY started_at DESC
    `)
    
    await pool.close()
    
    return NextResponse.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length,
      message: 'Simple evaluations endpoint working with auto-created table',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Simple evaluations error:', error)
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