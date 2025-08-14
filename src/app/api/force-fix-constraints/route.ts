import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'

/**
 * EMERGENCY FIX: Force fix all status constraints
 * This endpoint aggressively fixes database constraints
 */
export async function GET() {
  let pool: any = null
  try {
    pool = await getDbConnection()
    const fixResults = []
    
    console.log('🚨 EMERGENCY CONSTRAINT FIX STARTING...')
    
    // Step 1: Drop ALL constraints on status columns (nuclear option)
    try {
      // Find and drop all check constraints on evaluation_sessions
      const evalConstraints = await pool.request().query(`
        SELECT cc.name as constraint_name
        FROM sys.check_constraints cc
        INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
        WHERE t.name = 'evaluation_sessions'
      `)
      
      for (const row of evalConstraints.recordset) {
        try {
          await pool.request().query(`
            ALTER TABLE evaluation_sessions DROP CONSTRAINT ${row.constraint_name}
          `)
          fixResults.push(`✅ Dropped evaluation_sessions constraint: ${row.constraint_name}`)
        } catch (e: any) {
          fixResults.push(`⚠️ Could not drop ${row.constraint_name}: ${e.message}`)
        }
      }
      
      // Find and drop all check constraints on evaluation_files
      const fileConstraints = await pool.request().query(`
        SELECT cc.name as constraint_name
        FROM sys.check_constraints cc
        INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
        WHERE t.name = 'evaluation_files'
      `)
      
      for (const row of fileConstraints.recordset) {
        try {
          await pool.request().query(`
            ALTER TABLE evaluation_files DROP CONSTRAINT ${row.constraint_name}
          `)
          fixResults.push(`✅ Dropped evaluation_files constraint: ${row.constraint_name}`)
        } catch (e: any) {
          fixResults.push(`⚠️ Could not drop ${row.constraint_name}: ${e.message}`)
        }
      }
    } catch (e: any) {
      fixResults.push(`❌ Error dropping constraints: ${e.message}`)
    }
    
    // Step 2: Update all existing 'pending' records BEFORE adding new constraints
    try {
      const updateResult1 = await pool.request().query(`
        UPDATE evaluation_sessions 
        SET status = 'created' 
        WHERE status = 'pending' OR status NOT IN ('created', 'processing', 'completed', 'failed', 'cancelled')
      `)
      fixResults.push(`✅ Updated ${updateResult1.rowsAffected[0]} evaluation_sessions records`)
      
      const updateResult2 = await pool.request().query(`
        UPDATE evaluation_files 
        SET status = 'created' 
        WHERE status = 'pending' OR status NOT IN ('created', 'uploading', 'uploaded', 'processing', 'completed', 'failed')
      `)
      fixResults.push(`✅ Updated ${updateResult2.rowsAffected[0]} evaluation_files records`)
    } catch (e: any) {
      fixResults.push(`❌ Error updating records: ${e.message}`)
    }
    
    // Step 3: Alter columns to remove any default constraints
    try {
      // Remove defaults first
      await pool.request().query(`
        DECLARE @constraint_name NVARCHAR(256)
        SELECT @constraint_name = dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
        JOIN sys.tables t ON c.object_id = t.object_id
        WHERE t.name = 'evaluation_sessions' AND c.name = 'status'
        
        IF @constraint_name IS NOT NULL
        BEGIN
          EXEC('ALTER TABLE evaluation_sessions DROP CONSTRAINT ' + @constraint_name)
        END
      `)
      
      await pool.request().query(`
        DECLARE @constraint_name NVARCHAR(256)
        SELECT @constraint_name = dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
        JOIN sys.tables t ON c.object_id = t.object_id
        WHERE t.name = 'evaluation_files' AND c.name = 'status'
        
        IF @constraint_name IS NOT NULL
        BEGIN
          EXEC('ALTER TABLE evaluation_files DROP CONSTRAINT ' + @constraint_name)
        END
      `)
      
      // Set new defaults
      await pool.request().query(`
        ALTER TABLE evaluation_sessions 
        ADD DEFAULT 'created' FOR status
      `)
      
      await pool.request().query(`
        ALTER TABLE evaluation_files 
        ADD DEFAULT 'created' FOR status
      `)
      
      fixResults.push('✅ Reset column defaults to "created"')
    } catch (e: any) {
      fixResults.push(`⚠️ Could not reset defaults: ${e.message}`)
    }
    
    // Step 4: Add NEW constraints with correct values
    try {
      // Add constraint for evaluation_sessions
      await pool.request().query(`
        ALTER TABLE evaluation_sessions
        ADD CONSTRAINT CHK_evaluation_sessions_status_fixed
        CHECK (status IN ('created', 'processing', 'completed', 'failed', 'cancelled'))
      `)
      fixResults.push('✅ Added new constraint CHK_evaluation_sessions_status_fixed')
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        fixResults.push('⚠️ Evaluation sessions constraint already exists')
      } else {
        fixResults.push(`❌ Could not add evaluation_sessions constraint: ${e.message}`)
      }
    }
    
    try {
      // Add constraint for evaluation_files
      await pool.request().query(`
        ALTER TABLE evaluation_files
        ADD CONSTRAINT CHK_evaluation_files_status_fixed
        CHECK (status IN ('created', 'uploading', 'uploaded', 'processing', 'completed', 'failed'))
      `)
      fixResults.push('✅ Added new constraint CHK_evaluation_files_status_fixed')
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        fixResults.push('⚠️ Evaluation files constraint already exists')
      } else {
        fixResults.push(`❌ Could not add evaluation_files constraint: ${e.message}`)
      }
    }
    
    // Step 5: Verify the fix worked
    try {
      // Test insert with 'created' status
      await pool.request()
        .input('testId', sql.UniqueIdentifier, '00000000-0000-0000-0000-000000000000')
        .query(`
          INSERT INTO evaluation_sessions (id, user_id, role_id, name, status, total_files)
          VALUES (NEWID(), @testId, @testId, 'TEST_CONSTRAINT', 'created', 0)
        `)
      
      // Clean up test
      await pool.request().query(`
        DELETE FROM evaluation_sessions WHERE name = 'TEST_CONSTRAINT'
      `)
      
      fixResults.push('✅ VERIFIED: Constraint fix successful!')
    } catch (e: any) {
      fixResults.push(`❌ VERIFICATION FAILED: ${e.message}`)
    }
    
    // Get final constraint status
    const finalConstraints = await pool.request().query(`
      SELECT 
        t.name as table_name,
        cc.name as constraint_name,
        cc.definition
      FROM sys.check_constraints cc
      INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
      WHERE t.name IN ('evaluation_sessions', 'evaluation_files')
    `)

    return NextResponse.json({
      success: true,
      message: '🚨 EMERGENCY FIX COMPLETED',
      fixes: fixResults,
      currentConstraints: finalConstraints.recordset,
      validStatuses: {
        evaluation_sessions: ['created', 'processing', 'completed', 'failed', 'cancelled'],
        evaluation_files: ['created', 'uploading', 'uploaded', 'processing', 'completed', 'failed']
      },
      nextSteps: [
        '1. Test evaluation creation immediately',
        '2. Monitor for any errors',
        '3. Report any issues that persist'
      ]
    })
  } catch (error) {
    console.error('❌ EMERGENCY FIX FAILED:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Emergency fix failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
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

// Also support POST for safety
export async function POST() {
  return GET()
}