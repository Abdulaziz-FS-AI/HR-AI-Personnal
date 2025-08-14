import { NextResponse } from 'next/server'
import { getVercelDbConnection, executeVercelQuery } from '@/lib/db-vercel'

export async function POST() {
  const startTime = Date.now()
  
  try {
    console.log('🔧 FIXING STATUS CONSTRAINT - FINAL SOLUTION')
    
    // Step 1: Connect to database
    const pool = await getVercelDbConnection()
    console.log('✅ Connected to database')
    
    // Step 2: Drop the problematic constraint
    try {
      await executeVercelQuery(`
        ALTER TABLE evaluation_sessions 
        DROP CONSTRAINT CK__evaluatio__statu__6442E2C9
      `)
      console.log('✅ Dropped old constraint')
    } catch (dropError) {
      console.log('⚠️ Constraint may not exist or already dropped:', dropError)
    }
    
    // Step 3: Check current status values in the table
    const statusCheck = await executeVercelQuery(`
      SELECT DISTINCT status, COUNT(*) as count 
      FROM evaluation_sessions 
      GROUP BY status
    `)
    
    console.log('Current status values:', statusCheck.recordset)
    
    // Step 4: Update any invalid status values
    const validStatuses = ['pending', 'processing', 'completed', 'failed']
    
    // Update draft to pending
    await executeVercelQuery(`
      UPDATE evaluation_sessions 
      SET status = 'pending' 
      WHERE status = 'draft'
    `)
    
    // Update completed_with_errors to failed
    await executeVercelQuery(`
      UPDATE evaluation_sessions 
      SET status = 'failed' 
      WHERE status = 'completed_with_errors'
    `)
    
    // Update any other invalid statuses to pending
    await executeVercelQuery(`
      UPDATE evaluation_sessions 
      SET status = 'pending' 
      WHERE status NOT IN ('pending', 'processing', 'completed', 'failed')
    `)
    
    console.log('✅ Updated invalid status values')
    
    // Step 5: Create new constraint with correct values
    await executeVercelQuery(`
      ALTER TABLE evaluation_sessions
      ADD CONSTRAINT CK_evaluation_status_valid
      CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
    `)
    
    console.log('✅ Created new constraint with valid values')
    
    // Step 6: Verify the fix
    const verifyResult = await executeVercelQuery(`
      SELECT 
        o.name AS constraint_name,
        c.definition
      FROM sys.check_constraints c
      JOIN sys.objects o ON c.object_id = o.object_id
      WHERE o.parent_object_id = OBJECT_ID('evaluation_sessions')
        AND o.name LIKE '%status%'
    `)
    
    // Step 7: Test with an insert
    const testId = crypto.randomUUID()
    const testUserId = '5A5D9AC4-48BB-4117-89F2-5B1D8FC383B8'
    const testRoleId = crypto.randomUUID()
    
    await executeVercelQuery(`
      INSERT INTO evaluation_sessions (
        id, user_id, role_id, name, 
        total_files, processed_files, failed_files, 
        status, created_at, started_at, updated_at
      )
      VALUES (
        @id, @userId, @roleId, 'Test Evaluation - Constraint Fix',
        0, 0, 0, 
        'pending', GETDATE(), GETDATE(), GETDATE()
      )
    `, {
      id: testId,
      userId: testUserId,
      roleId: testRoleId
    })
    
    console.log('✅ Test insert successful with status="pending"')
    
    // Clean up test record
    await executeVercelQuery(`
      DELETE FROM evaluation_sessions WHERE id = @id
    `, { id: testId })
    
    return NextResponse.json({
      success: true,
      message: 'Status constraint fixed successfully',
      constraint: verifyResult.recordset[0] || 'No constraint found',
      validValues: validStatuses,
      testResult: 'Insert test passed',
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Fix constraint error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fix status constraint',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Check current constraint
    const result = await executeVercelQuery(`
      SELECT 
        o.name AS constraint_name,
        c.definition,
        OBJECT_NAME(o.parent_object_id) as table_name
      FROM sys.check_constraints c
      JOIN sys.objects o ON c.object_id = o.object_id
      WHERE o.parent_object_id = OBJECT_ID('evaluation_sessions')
    `)
    
    // Check current status values
    const statusValues = await executeVercelQuery(`
      SELECT DISTINCT status, COUNT(*) as count 
      FROM evaluation_sessions 
      GROUP BY status
      ORDER BY count DESC
    `)
    
    return NextResponse.json({
      success: true,
      constraints: result.recordset,
      currentStatusValues: statusValues.recordset,
      recommendedAction: 'POST to this endpoint to fix the constraint',
      validStatuses: ['pending', 'processing', 'completed', 'failed']
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}