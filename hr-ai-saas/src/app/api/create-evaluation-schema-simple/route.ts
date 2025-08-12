import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'

export async function GET() {
  const results = []
  
  try {
    const pool = await getDbConnection()
    
    // 1. Create evaluation_sessions table
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_sessions' AND xtype='U')
        CREATE TABLE evaluation_sessions (
          id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
          user_id UNIQUEIDENTIFIER NOT NULL,
          role_id UNIQUEIDENTIFIER NOT NULL,
          name NVARCHAR(255) NOT NULL,
          description NTEXT,
          status NVARCHAR(50) DEFAULT 'draft',
          total_files INT DEFAULT 0,
          processed_files INT DEFAULT 0,
          failed_files INT DEFAULT 0,
          average_score FLOAT,
          highest_score FLOAT,
          lowest_score FLOAT,
          created_at DATETIME2 DEFAULT GETUTCDATE(),
          started_at DATETIME2,
          completed_at DATETIME2
        )
      `)
      results.push('✅ evaluation_sessions table created')
    } catch (error) {
      results.push(`❌ evaluation_sessions: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
    
    // 2. Create evaluation_files table
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_files' AND xtype='U')
        CREATE TABLE evaluation_files (
          id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
          evaluation_id UNIQUEIDENTIFIER NOT NULL,
          file_name NVARCHAR(500) NOT NULL,
          blob_name NVARCHAR(500) NOT NULL,
          file_size BIGINT NOT NULL,
          status NVARCHAR(50) DEFAULT 'pending',
          extracted_text NTEXT,
          candidate_info NVARCHAR(MAX),
          overall_score FLOAT,
          recommendation NTEXT,
          created_at DATETIME2 DEFAULT GETUTCDATE(),
          processed_at DATETIME2
        )
      `)
      results.push('✅ evaluation_files table created')
    } catch (error) {
      results.push(`❌ evaluation_files: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
    
    // 3. Create evaluation_results table
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_results' AND xtype='U')
        CREATE TABLE evaluation_results (
          id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
          evaluation_id UNIQUEIDENTIFIER NOT NULL,
          file_id UNIQUEIDENTIFIER NOT NULL,
          scores NVARCHAR(MAX),
          skills_analysis NVARCHAR(MAX),
          questions_analysis NVARCHAR(MAX),
          summary NTEXT,
          strengths NVARCHAR(MAX),
          weaknesses NVARCHAR(MAX),
          red_flags NVARCHAR(MAX),
          recommendation NTEXT,
          suggested_interview_questions NVARCHAR(MAX),
          created_at DATETIME2 DEFAULT GETUTCDATE()
        )
      `)
      results.push('✅ evaluation_results table created')
    } catch (error) {
      results.push(`❌ evaluation_results: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
    
    // 4. Add evaluation_id to uploaded_files if it doesn't exist
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('uploaded_files') AND name = 'evaluation_id')
        ALTER TABLE uploaded_files ADD evaluation_id UNIQUEIDENTIFIER
      `)
      results.push('✅ evaluation_id column added to uploaded_files')
    } catch (error) {
      results.push(`❌ uploaded_files column: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
    
    // 5. Create essential indexes
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_sessions_user_id' AND object_id = OBJECT_ID('evaluation_sessions'))
        CREATE INDEX IX_evaluation_sessions_user_id ON evaluation_sessions(user_id)
      `)
      results.push('✅ Index IX_evaluation_sessions_user_id created')
    } catch (error) {
      results.push(`❌ Index IX_evaluation_sessions_user_id: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
    
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_files_evaluation_id' AND object_id = OBJECT_ID('evaluation_files'))
        CREATE INDEX IX_evaluation_files_evaluation_id ON evaluation_files(evaluation_id)
      `)
      results.push('✅ Index IX_evaluation_files_evaluation_id created')
    } catch (error) {
      results.push(`❌ Index IX_evaluation_files_evaluation_id: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
    
    // 6. Test that tables exist
    const tablesCheck = await pool.request().query(`
      SELECT name FROM sysobjects 
      WHERE name IN ('evaluation_sessions', 'evaluation_files', 'evaluation_results') 
      AND xtype='U'
    `)
    
    const existingTables = tablesCheck.recordset.map(row => row.name)
    results.push(`📊 Tables verified: ${existingTables.join(', ')}`)
    
    const errorCount = results.filter(r => r.includes('❌')).length
    const successCount = results.filter(r => r.includes('✅')).length
    
    return NextResponse.json({
      success: errorCount === 0,
      message: `Schema deployment completed: ${successCount} successful, ${errorCount} errors`,
      results,
      existingTables,
      summary: {
        total: results.length - 1, // excluding verification
        successful: successCount,
        errors: errorCount
      }
    })
    
  } catch (error) {
    console.error('Error in schema deployment:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to deploy evaluation schema',
        details: error instanceof Error ? error.message : 'Unknown error',
        results
      },
      { status: 500 }
    )
  }
}