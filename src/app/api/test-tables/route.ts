import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db-config'

export async function GET() {
  try {
    const pool = await getDbConnection()
    
    // Check all tables
    const result = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE_TABLE'
      ORDER BY TABLE_NAME
    `)
    
    await pool.close()
    
    return NextResponse.json({
      success: true,
      tables: result.recordset.map(row => row.TABLE_NAME),
      count: result.recordset.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Table check error:', error)
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