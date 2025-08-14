import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db-config'

export async function GET() {
  try {
    const pool = await getDbConnection()
    
    // Check SQL Server version and test table creation
    const versionResult = await pool.request().query(`
      SELECT @@VERSION as version
    `)
    
    // Test simple table creation
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[test_table]') AND type in (N'U'))
      CREATE TABLE test_table (id int, name nvarchar(50))
    `)
    
    // Check if test table was created
    const testTableResult = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'test_table'
    `)
    
    // Clean up test table
    await pool.request().query(`
      DROP TABLE IF EXISTS test_table
    `)
    
    await pool.close()
    
    return NextResponse.json({
      success: true,
      sqlVersion: versionResult.recordset[0]?.version,
      testTableCreated: testTableResult.recordset.length > 0,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('SQL Server test error:', error)
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