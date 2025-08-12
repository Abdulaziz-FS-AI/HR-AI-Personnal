import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'

export async function GET() {
  try {
    const pool = await getDbConnection()
    
    // Test query to check evaluation tables
    const result = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM evaluation_sessions) as sessions_count,
        (SELECT COUNT(*) FROM evaluation_files) as files_count,
        (SELECT COUNT(*) FROM evaluation_results) as results_count
    `)
    
    // Get sample data
    const sessions = await pool.request().query(`
      SELECT TOP 5 id, name, status, total_files, created_at
      FROM evaluation_sessions
      ORDER BY created_at DESC
    `)
    
    const files = await pool.request().query(`
      SELECT TOP 5 id, file_name, status, created_at
      FROM evaluation_files
      ORDER BY created_at DESC
    `)
    
    return NextResponse.json({
      success: true,
      counts: result.recordset[0],
      recentSessions: sessions.recordset,
      recentFiles: files.recordset,
      message: 'Evaluation file system is working!'
    })
  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}