import { NextRequest, NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'

export async function POST(request: NextRequest) {
  console.log('🚀 Starting bonus/penalty schema deployment...')
  
  try {
    const pool = await getDbConnection()
    
    // Check if bonus_config and penalty_config columns already exist
    const checkColumnsQuery = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'roles' 
      AND COLUMN_NAME IN ('bonus_config', 'penalty_config')
    `
    
    const existingColumns = await pool.request().query(checkColumnsQuery)
    const hasColumns = existingColumns.recordset.length > 0
    
    if (hasColumns) {
      console.log('✅ Bonus/penalty columns already exist')
      return NextResponse.json({
        success: true,
        message: 'Bonus/penalty schema already exists',
        skipped: true
      })
    }
    
    console.log('📝 Adding bonus_config and penalty_config columns to roles table...')
    
    // Add bonus_config and penalty_config columns to the roles table
    const alterTableQuery = `
      ALTER TABLE roles 
      ADD 
        bonus_config NVARCHAR(MAX) NULL,
        penalty_config NVARCHAR(MAX) NULL
    `
    
    await pool.request().query(alterTableQuery)
    
    console.log('✅ Successfully added bonus/penalty configuration columns')
    
    // Test the new columns by selecting from the roles table
    const testQuery = `
      SELECT TOP 1 
        id, 
        title, 
        bonus_config, 
        penalty_config 
      FROM roles
    `
    
    const testResult = await pool.request().query(testQuery)
    console.log('🧪 Test query successful - columns accessible')
    
    return NextResponse.json({
      success: true,
      message: 'Bonus/penalty schema deployed successfully',
      details: {
        columnsAdded: ['bonus_config', 'penalty_config'],
        testRecord: testResult.recordset[0] || null
      }
    })
    
  } catch (error: any) {
    console.error('❌ Error deploying bonus/penalty schema:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        type: 'schema_deployment_error',
        phase: 'column_addition'
      }
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const pool = await getDbConnection()
    
    // Check schema status
    const checkQuery = `
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'roles' 
      AND COLUMN_NAME IN ('bonus_config', 'penalty_config')
      ORDER BY COLUMN_NAME
    `
    
    const result = await pool.request().query(checkQuery)
    
    return NextResponse.json({
      success: true,
      schema: {
        table: 'roles',
        bonusPenaltyColumns: result.recordset,
        status: result.recordset.length === 2 ? 'deployed' : 'missing'
      }
    })
    
  } catch (error: any) {
    console.error('❌ Error checking bonus/penalty schema:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}