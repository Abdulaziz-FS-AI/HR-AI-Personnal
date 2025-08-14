import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'
import sql from 'mssql'

export async function GET() {
  let pool: sql.ConnectionPool | null = null
  
  try {
    pool = await getDbConnection()
    
    // Check the exact status constraint
    const constraintResult = await pool.request().query(`
      SELECT 
        cc.CONSTRAINT_NAME,
        cc.CHECK_CLAUSE,
        ccu.TABLE_NAME,
        ccu.COLUMN_NAME
      FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
      JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
        ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
      WHERE ccu.TABLE_NAME = 'evaluation_sessions'
        AND ccu.COLUMN_NAME = 'status'
    `)
    
    return NextResponse.json({
      success: true,
      constraints: constraintResult.recordset,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
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