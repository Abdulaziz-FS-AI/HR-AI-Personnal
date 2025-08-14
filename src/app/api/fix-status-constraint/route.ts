import { NextRequest, NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'

export async function POST() {
  let pool = null
  
  try {
    pool = await getDbConnection()
    
    // Drop the existing constraint and add a new one with all needed statuses
    const fixConstraintQuery = `
      -- First, find and drop the existing CHECK constraint
      DECLARE @ConstraintName NVARCHAR(200)
      
      SELECT @ConstraintName = name
      FROM sys.check_constraints
      WHERE parent_object_id = OBJECT_ID('evaluation_sessions')
      AND definition LIKE '%status%'
      
      IF @ConstraintName IS NOT NULL
      BEGIN
        EXEC('ALTER TABLE evaluation_sessions DROP CONSTRAINT ' + @ConstraintName)
      END
      
      -- Add the new constraint with all allowed statuses
      ALTER TABLE evaluation_sessions
      ADD CONSTRAINT CK_evaluation_sessions_status 
      CHECK (status IN ('draft', 'pending', 'processing', 'completed', 'completed_with_errors', 'failed'))
    `
    
    await pool.request().query(fixConstraintQuery)
    
    // Also update batch_sessions table if it exists
    const fixBatchSessionsQuery = `
      IF EXISTS (SELECT * FROM sysobjects WHERE name='batch_sessions' AND xtype='U')
      BEGIN
        -- Find and drop existing constraint on batch_sessions
        DECLARE @BatchConstraintName NVARCHAR(200)
        
        SELECT @BatchConstraintName = name
        FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('batch_sessions')
        AND definition LIKE '%status%'
        
        IF @BatchConstraintName IS NOT NULL
        BEGIN
          EXEC('ALTER TABLE batch_sessions DROP CONSTRAINT ' + @BatchConstraintName)
        END
        
        -- Add new constraint
        ALTER TABLE batch_sessions
        ADD CONSTRAINT CK_batch_sessions_status 
        CHECK (status IN ('draft', 'pending', 'processing', 'completed', 'completed_with_errors', 'failed'))
      END
    `
    
    await pool.request().query(fixBatchSessionsQuery)
    
    await pool.close()
    
    return NextResponse.json({
      success: true,
      message: 'Status constraints updated successfully',
      allowedStatuses: ['draft', 'pending', 'processing', 'completed', 'completed_with_errors', 'failed']
    })
    
  } catch (error) {
    console.error('Error fixing status constraint:', error)
    
    if (pool) {
      await pool.close()
    }
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update status constraints',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to update the status constraints',
    description: 'This will update the CHECK constraints on evaluation_sessions and batch_sessions tables to allow all needed status values',
    allowedStatuses: ['draft', 'pending', 'processing', 'completed', 'completed_with_errors', 'failed']
  })
}