import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db-config'

export async function GET() {
  try {
    const pool = await getDbConnection()
    
    // Check current database and user context
    const contextResult = await pool.request().query(`
      SELECT 
        DB_NAME() as current_database,
        USER_NAME() as current_user_name,
        SCHEMA_NAME() as current_schema,
        SYSTEM_USER as system_user_name,
        @@SERVERNAME as server_name
    `)
    
    // Check what schemas exist
    const schemasResult = await pool.request().query(`
      SELECT schema_name 
      FROM information_schema.schemata
      ORDER BY schema_name
    `)
    
    // Check tables in all schemas
    const allTablesResult = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `)
    
    // Check sys.objects directly
    const sysObjectsResult = await pool.request().query(`
      SELECT 
        SCHEMA_NAME(schema_id) as schema_name,
        name,
        type_desc,
        create_date
      FROM sys.objects 
      WHERE type = 'U'
      ORDER BY schema_name, name
    `)
    
    await pool.close()
    
    return NextResponse.json({
      success: true,
      context: contextResult.recordset[0],
      schemas: schemasResult.recordset.map(r => r.schema_name),
      informationSchemaTables: allTablesResult.recordset,
      sysObjectsTables: sysObjectsResult.recordset,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Debug permissions error:', error)
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