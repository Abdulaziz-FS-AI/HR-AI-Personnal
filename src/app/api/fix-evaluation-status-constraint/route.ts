import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'

export async function GET() {
  let pool: any = null
  try {
    pool = await getDbConnection()
    const fixResults = []
    
    // 1. Drop any existing constraints on evaluation_sessions.status
    // Specifically target the problematic constraint first
    try {
      await pool.request().query(`
        IF EXISTS (
          SELECT * FROM sys.check_constraints 
          WHERE name = 'CK__evaluatio__statu__6442E2C9'
        )
        BEGIN
          ALTER TABLE evaluation_sessions 
          DROP CONSTRAINT CK__evaluatio__statu__6442E2C9
        END
      `)
      fixResults.push('Dropped specific constraint: CK__evaluatio__statu__6442E2C9')
    } catch (e) {
      console.log('Specific constraint may not exist:', e)
    }
    
    // Drop any other constraints on the status column
    try {
      const constraintsResult = await pool.request().query(`
        SELECT cc.name as constraint_name
        FROM sys.check_constraints cc
        INNER JOIN sys.columns c ON cc.parent_object_id = c.object_id 
        INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
        WHERE t.name = 'evaluation_sessions' AND c.name = 'status'
          AND cc.name != 'CHK_evaluation_sessions_status'
      `)
      
      for (const row of constraintsResult.recordset) {
        await pool.request().query(`
          ALTER TABLE evaluation_sessions 
          DROP CONSTRAINT ${row.constraint_name}
        `)
        fixResults.push(`Dropped constraint: ${row.constraint_name}`)
      }
    } catch (e) {
      console.log('No other constraints to drop or error dropping:', e)
    }

    // 2. Add proper constraint for evaluation_sessions
    try {
      await pool.request().query(`
        ALTER TABLE evaluation_sessions
        ADD CONSTRAINT CHK_evaluation_sessions_status 
        CHECK (status IN ('created', 'processing', 'completed', 'failed', 'cancelled'))
      `)
      fixResults.push('Added new constraint CHK_evaluation_sessions_status')
    } catch (e) {
      if (!e.message.includes('already exists')) {
        throw e
      }
      fixResults.push('Constraint CHK_evaluation_sessions_status already exists')
    }

    // 3. Update any existing 'pending' status to 'created' in evaluation_sessions
    const updateResult1 = await pool.request().query(`
      UPDATE evaluation_sessions 
      SET status = 'created' 
      WHERE status = 'pending'
    `)
    fixResults.push(`Updated ${updateResult1.rowsAffected[0]} rows in evaluation_sessions from 'pending' to 'created'`)

    // 4. Drop any existing constraints on evaluation_files.status
    try {
      const fileConstraintsResult = await pool.request().query(`
        SELECT cc.name as constraint_name
        FROM sys.check_constraints cc
        INNER JOIN sys.columns c ON cc.parent_object_id = c.object_id 
        INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
        WHERE t.name = 'evaluation_files' AND c.name = 'status'
      `)
      
      for (const row of fileConstraintsResult.recordset) {
        await pool.request().query(`
          ALTER TABLE evaluation_files 
          DROP CONSTRAINT ${row.constraint_name}
        `)
        fixResults.push(`Dropped constraint: ${row.constraint_name} from evaluation_files`)
      }
    } catch (e) {
      console.log('No existing constraints on evaluation_files or error:', e)
    }

    // 5. Add proper constraint for evaluation_files
    try {
      await pool.request().query(`
        ALTER TABLE evaluation_files
        ADD CONSTRAINT CHK_evaluation_files_status 
        CHECK (status IN ('created', 'uploading', 'uploaded', 'processing', 'completed', 'failed'))
      `)
      fixResults.push('Added new constraint CHK_evaluation_files_status')
    } catch (e) {
      if (!e.message.includes('already exists')) {
        throw e
      }
      fixResults.push('Constraint CHK_evaluation_files_status already exists')
    }

    // 6. Update any existing 'pending' status to 'created' in evaluation_files
    const updateResult2 = await pool.request().query(`
      UPDATE evaluation_files 
      SET status = 'created' 
      WHERE status = 'pending'
    `)
    fixResults.push(`Updated ${updateResult2.rowsAffected[0]} rows in evaluation_files from 'pending' to 'created'`)

    // 7. Verify the constraints are properly set
    const verifyResult = await pool.request().query(`
      SELECT 
        t.name as table_name,
        c.name as column_name,
        cc.name as constraint_name,
        cc.definition
      FROM sys.check_constraints cc
      INNER JOIN sys.columns c ON cc.parent_object_id = c.object_id 
      INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
      WHERE t.name IN ('evaluation_sessions', 'evaluation_files') AND c.name = 'status'
    `)

    return NextResponse.json({
      success: true,
      message: 'Evaluation status constraints fixed successfully',
      fixes: fixResults,
      currentConstraints: verifyResult.recordset,
      validStatuses: {
        evaluation_sessions: ['created', 'processing', 'completed', 'failed', 'cancelled'],
        evaluation_files: ['created', 'uploading', 'uploaded', 'processing', 'completed', 'failed']
      }
    })
  } catch (error) {
    console.error('Constraint fix error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fix evaluation status constraints',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  } finally {
    if (pool) {
      try {
        await pool.close()
      } catch (e) {
        console.error('Error closing pool:', e)
      }
    }
  }
}