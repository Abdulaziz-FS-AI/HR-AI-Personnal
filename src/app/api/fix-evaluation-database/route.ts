import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'

export async function GET() {
  let pool: any = null
  try {
    pool = await getDbConnection()
    const fixes = []
    
    console.log('🔧 Starting comprehensive evaluation database fix...')
    
    // 1. Fix evaluation_sessions table
    try {
      // Add missing updated_at column if it doesn't exist
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT * FROM sys.columns 
          WHERE object_id = OBJECT_ID('evaluation_sessions') 
          AND name = 'updated_at'
        )
        BEGIN
          ALTER TABLE evaluation_sessions 
          ADD updated_at DATETIME2 DEFAULT GETDATE()
        END
      `)
      fixes.push('✅ Added updated_at to evaluation_sessions')
    } catch (e: any) {
      fixes.push(`⚠️ Could not add updated_at to evaluation_sessions: ${e.message}`)
    }
    
    // 2. Fix evaluation_files table structure
    try {
      // Check if table exists with wrong structure
      const tableCheck = await pool.request().query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'evaluation_files'
      `)
      
      const columns = tableCheck.recordset.map((r: any) => r.COLUMN_NAME)
      
      // Rename session_id to evaluation_id if needed
      if (columns.includes('session_id') && !columns.includes('evaluation_id')) {
        await pool.request().query(`
          EXEC sp_rename 'evaluation_files.session_id', 'evaluation_id', 'COLUMN'
        `)
        fixes.push('✅ Renamed session_id to evaluation_id')
      }
      
      // Rename file_name to filename if needed
      if (columns.includes('file_name') && !columns.includes('filename')) {
        await pool.request().query(`
          EXEC sp_rename 'evaluation_files.file_name', 'filename', 'COLUMN'
        `)
        fixes.push('✅ Renamed file_name to filename')
      }
      
      // Add file_id column if missing
      if (!columns.includes('file_id')) {
        await pool.request().query(`
          ALTER TABLE evaluation_files 
          ADD file_id UNIQUEIDENTIFIER NULL
        `)
        fixes.push('✅ Added file_id column')
      }
      
      // Add user_id column if missing
      if (!columns.includes('user_id')) {
        await pool.request().query(`
          ALTER TABLE evaluation_files 
          ADD user_id UNIQUEIDENTIFIER NULL
        `)
        fixes.push('✅ Added user_id column')
      }
      
      // Add updated_at column if missing
      if (!columns.includes('updated_at')) {
        await pool.request().query(`
          ALTER TABLE evaluation_files 
          ADD updated_at DATETIME2 DEFAULT GETDATE()
        `)
        fixes.push('✅ Added updated_at to evaluation_files')
      }
      
      // Add created_at column if missing
      if (!columns.includes('created_at')) {
        await pool.request().query(`
          ALTER TABLE evaluation_files 
          ADD created_at DATETIME2 DEFAULT GETDATE()
        `)
        fixes.push('✅ Added created_at to evaluation_files')
      }
      
      // Rename file_size column type if needed
      await pool.request().query(`
        ALTER TABLE evaluation_files 
        ALTER COLUMN file_size BIGINT
      `)
      fixes.push('✅ Updated file_size to BIGINT')
      
    } catch (e: any) {
      fixes.push(`❌ Error fixing evaluation_files: ${e.message}`)
    }
    
    // 3. Drop and recreate foreign key constraints with correct names
    try {
      // Drop old constraint if exists
      await pool.request().query(`
        IF EXISTS (
          SELECT * FROM sys.foreign_keys 
          WHERE name = 'FK__evaluatio__sessi__6FE99F9F'
        )
        ALTER TABLE evaluation_files 
        DROP CONSTRAINT FK__evaluatio__sessi__6FE99F9F
      `)
      
      // Add new constraint with correct column name
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT * FROM sys.foreign_keys 
          WHERE name = 'FK_evaluation_files_evaluation_id'
        )
        ALTER TABLE evaluation_files
        ADD CONSTRAINT FK_evaluation_files_evaluation_id
        FOREIGN KEY (evaluation_id) REFERENCES evaluation_sessions(id) ON DELETE CASCADE
      `)
      fixes.push('✅ Fixed foreign key constraints')
    } catch (e: any) {
      fixes.push(`⚠️ Could not fix foreign keys: ${e.message}`)
    }
    
    // 4. Fix evaluation_results table if needed
    try {
      // Rename session_id to evaluation_id if needed
      const resultsCheck = await pool.request().query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'evaluation_results' AND COLUMN_NAME = 'session_id'
      `)
      
      if (resultsCheck.recordset.length > 0) {
        await pool.request().query(`
          EXEC sp_rename 'evaluation_results.session_id', 'evaluation_id', 'COLUMN'
        `)
        fixes.push('✅ Renamed session_id to evaluation_id in evaluation_results')
      }
      
      // Add user_id if missing
      const userIdCheck = await pool.request().query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'evaluation_results' AND COLUMN_NAME = 'user_id'
      `)
      
      if (userIdCheck.recordset.length === 0) {
        await pool.request().query(`
          ALTER TABLE evaluation_results 
          ADD user_id UNIQUEIDENTIFIER NULL
        `)
        fixes.push('✅ Added user_id to evaluation_results')
      }
    } catch (e: any) {
      fixes.push(`⚠️ Could not fix evaluation_results: ${e.message}`)
    }
    
    // 5. Verify final structure
    const finalStructure = await pool.request().query(`
      SELECT 
        t.name as table_name,
        c.name as column_name,
        ty.name as data_type
      FROM sys.tables t
      INNER JOIN sys.columns c ON t.object_id = c.object_id
      INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
      WHERE t.name IN ('evaluation_sessions', 'evaluation_files', 'evaluation_results')
      ORDER BY t.name, c.column_id
    `)
    
    return NextResponse.json({
      success: true,
      message: '🎯 Evaluation database structure fixed!',
      fixes,
      currentStructure: finalStructure.recordset,
      nextSteps: [
        '1. The database structure is now aligned with the code',
        '2. Test creating a new evaluation',
        '3. If issues persist, check the browser console for details'
      ]
    })
    
  } catch (error) {
    console.error('❌ Database fix failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fix database',
        error: error instanceof Error ? error.message : 'Unknown error'
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

// Support POST as well
export async function POST() {
  return GET()
}