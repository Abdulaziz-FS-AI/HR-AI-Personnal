import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'

export async function GET() {
  let pool = null
  
  try {
    pool = await getDbConnection()
    
    // First check current constraint
    const checkResult = await pool.request().query(`
      SELECT 
        cc.name as constraint_name,
        cc.definition
      FROM sys.check_constraints cc
      WHERE parent_object_id = OBJECT_ID('evaluation_sessions')
      AND cc.definition LIKE '%status%'
    `)
    
    console.log('Current constraint:', checkResult.recordset)
    
    // Drop and recreate constraint
    try {
      // Try to drop the old constraint by its actual name
      await pool.request().query(`
        ALTER TABLE evaluation_sessions DROP CONSTRAINT CK__evaluatio__statu__6442E2C9
      `)
    } catch (dropError) {
      console.log('Constraint might not exist or has different name:', dropError.message)
    }
    
    // Add new constraint
    await pool.request().query(`
      ALTER TABLE evaluation_sessions
      ADD CONSTRAINT CK_evaluation_sessions_status 
      CHECK (status IN ('draft', 'pending', 'processing', 'completed', 'completed_with_errors', 'failed'))
    `)
    
    await pool.close()
    
    return NextResponse.json({
      success: true,
      message: 'Constraint fixed successfully',
      allowedStatuses: ['draft', 'pending', 'processing', 'completed', 'completed_with_errors', 'failed']
    })
    
  } catch (error) {
    console.error('Error:', error)
    
    if (pool) {
      await pool.close()
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}