import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'
import sql from 'mssql'

export async function GET() {
  let pool: sql.ConnectionPool | null = null
  
  try {
    pool = await getDbConnection()
    
    // Check recent evaluation sessions (last 24 hours)
    const sessionsResult = await pool.request().query(`
      SELECT TOP 10 
        es.id,
        es.name,
        es.status,
        es.total_files,
        es.processed_files,
        es.failed_files,
        es.created_at,
        es.updated_at,
        r.title as role_title,
        u.email as user_email
      FROM evaluation_sessions es
      LEFT JOIN roles r ON es.role_id = r.id
      LEFT JOIN users u ON es.user_id = u.id
      WHERE es.created_at >= DATEADD(day, -1, GETDATE())
      ORDER BY es.created_at DESC
    `)

    // Check recent evaluation files (last 24 hours)  
    const filesResult = await pool.request().query(`
      SELECT TOP 10 
        ef.id,
        ef.file_name,
        ef.status,
        ef.overall_score,
        ef.created_at,
        ef.processed_at,
        es.name as session_name
      FROM evaluation_files ef
      LEFT JOIN evaluation_sessions es ON ef.evaluation_id = es.id
      WHERE ef.created_at >= DATEADD(day, -1, GETDATE())
      ORDER BY ef.created_at DESC
    `)

    // Check recent evaluation results (last 24 hours)
    const resultsResult = await pool.request().query(`
      SELECT TOP 10 
        er.id,
        ef.file_name,
        er.recommendation,
        er.created_at,
        es.name as session_name
      FROM evaluation_results er
      JOIN evaluation_files ef ON er.file_id = ef.id
      LEFT JOIN evaluation_sessions es ON er.evaluation_id = es.id
      WHERE er.created_at >= DATEADD(day, -1, GETDATE())
      ORDER BY er.created_at DESC
    `)

    // Check if evaluation tables exist
    const tablesCheck = await pool.request().query(`
      SELECT 
        name,
        create_date,
        modify_date
      FROM sys.tables 
      WHERE name IN ('evaluation_sessions', 'evaluation_files', 'evaluation_results')
    `)

    await pool.close()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        tables: tablesCheck.recordset,
        recentSessions: sessionsResult.recordset,
        recentFiles: filesResult.recordset,
        recentResults: resultsResult.recordset
      }
    })

  } catch (error) {
    console.error('Database check error:', error)
    
    if (pool) {
      await pool.close()
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}