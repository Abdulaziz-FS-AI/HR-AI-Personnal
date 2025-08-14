import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'

export async function POST() {
  let pool = null
  
  try {
    pool = await getDbConnection()
    
    // Create evaluation_sessions table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_sessions' AND xtype='U')
      BEGIN
        CREATE TABLE evaluation_sessions (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          user_id UNIQUEIDENTIFIER NOT NULL,
          role_id UNIQUEIDENTIFIER NOT NULL,
          name NVARCHAR(200) NOT NULL,
          total_files INT DEFAULT 0,
          processed_files INT DEFAULT 0,
          failed_files INT DEFAULT 0,
          status NVARCHAR(50) DEFAULT 'pending',
          created_at DATETIME2 DEFAULT GETDATE(),
          started_at DATETIME2,
          completed_at DATETIME2,
          updated_at DATETIME2 DEFAULT GETDATE(),
          average_score DECIMAL(5,2),
          error_message NVARCHAR(MAX)
        )
      END
    `)

    // Create evaluation_files table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_files' AND xtype='U')
      BEGIN
        CREATE TABLE evaluation_files (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          evaluation_id UNIQUEIDENTIFIER NOT NULL,
          file_name NVARCHAR(255) NOT NULL,
          file_size BIGINT,
          blob_name NVARCHAR(255),
          status NVARCHAR(50) DEFAULT 'pending',
          extracted_text NVARCHAR(MAX),
          candidate_info NVARCHAR(MAX),
          overall_score DECIMAL(5,2),
          created_at DATETIME2 DEFAULT GETDATE(),
          processed_at DATETIME2
        )
      END
    `)

    // Create evaluation_results table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_results' AND xtype='U')
      BEGIN
        CREATE TABLE evaluation_results (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          evaluation_id UNIQUEIDENTIFIER NOT NULL,
          file_id UNIQUEIDENTIFIER NOT NULL,
          skills_analysis NVARCHAR(MAX),
          questions_analysis NVARCHAR(MAX),
          recommendation NVARCHAR(MAX),
          red_flags NVARCHAR(MAX),
          strengths NVARCHAR(MAX),
          weaknesses NVARCHAR(MAX),
          created_at DATETIME2 DEFAULT GETDATE()
        )
      END
    `)

    // Add basic indexes
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_sessions_user_id')
      CREATE INDEX IX_evaluation_sessions_user_id ON evaluation_sessions(user_id)
    `)

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_files_evaluation_id')
      CREATE INDEX IX_evaluation_files_evaluation_id ON evaluation_files(evaluation_id)
    `)

    await pool.close()

    return NextResponse.json({
      success: true,
      message: 'Evaluation tables created successfully',
      tables: ['evaluation_sessions', 'evaluation_files', 'evaluation_results'],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Schema creation error:', error)
    
    if (pool) {
      await pool.close()
    }
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}