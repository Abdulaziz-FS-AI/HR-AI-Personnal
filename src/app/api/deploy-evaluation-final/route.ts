import { NextRequest, NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db-config'

export async function POST() {
  try {
    const pool = await getDbConnection()

    // Evaluation schema deployment
    const schema = `
      -- evaluation_sessions table
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[evaluation_sessions]') AND type in (N'U'))
      BEGIN
        CREATE TABLE evaluation_sessions (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          user_id UNIQUEIDENTIFIER NOT NULL,
          role_id UNIQUEIDENTIFIER NOT NULL,
          name NVARCHAR(200) NOT NULL,
          status NVARCHAR(50) NOT NULL DEFAULT 'pending',
          total_files INT NOT NULL DEFAULT 0,
          processed_files INT NOT NULL DEFAULT 0,
          failed_files INT NOT NULL DEFAULT 0,
          average_score DECIMAL(5,2) NULL,
          created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          started_at DATETIME2 NULL,
          completed_at DATETIME2 NULL,
          updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          error_message NVARCHAR(MAX) NULL
        )
      END

      -- evaluation_files table
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[evaluation_files]') AND type in (N'U'))
      BEGIN
        CREATE TABLE evaluation_files (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          evaluation_id UNIQUEIDENTIFIER NOT NULL,
          file_name NVARCHAR(255) NOT NULL,
          file_size BIGINT NULL,
          file_url NVARCHAR(500) NULL,
          blob_name NVARCHAR(255) NULL,
          status NVARCHAR(50) NOT NULL DEFAULT 'uploaded',
          extracted_text NVARCHAR(MAX) NULL,
          candidate_info NVARCHAR(MAX) NULL,
          overall_score DECIMAL(5,2) NULL,
          parse_error NVARCHAR(MAX) NULL,
          uploaded_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          processed_at DATETIME2 NULL
        )
      END

      -- evaluation_results table
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[evaluation_results]') AND type in (N'U'))
      BEGIN
        CREATE TABLE evaluation_results (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          evaluation_id UNIQUEIDENTIFIER NOT NULL,
          file_id UNIQUEIDENTIFIER NOT NULL,
          role_id UNIQUEIDENTIFIER NULL,
          candidate_name NVARCHAR(255) NULL,
          candidate_email NVARCHAR(255) NULL,
          candidate_phone NVARCHAR(50) NULL,
          overall_score DECIMAL(5,2) NOT NULL DEFAULT 0,
          skills_score DECIMAL(5,2) NULL,
          experience_score DECIMAL(5,2) NULL,
          education_score DECIMAL(5,2) NULL,
          skills_analysis NVARCHAR(MAX) NULL,
          questions_analysis NVARCHAR(MAX) NULL,
          recommendations NVARCHAR(MAX) NULL,
          red_flags NVARCHAR(MAX) NULL,
          strengths NVARCHAR(MAX) NULL,
          weaknesses NVARCHAR(MAX) NULL,
          ai_analysis NVARCHAR(MAX) NULL,
          total_tokens_used INT DEFAULT 0,
          created_at DATETIME2 NOT NULL DEFAULT GETDATE()
        )
      END

      -- Indices for performance
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_sessions_user_id')
        CREATE INDEX IX_evaluation_sessions_user_id ON evaluation_sessions(user_id)

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_files_evaluation_id')
        CREATE INDEX IX_evaluation_files_evaluation_id ON evaluation_files(evaluation_id)

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_results_evaluation_id')
        CREATE INDEX IX_evaluation_results_evaluation_id ON evaluation_results(evaluation_id)
    `

    await pool.request().query(schema)
    await pool.close()

    return NextResponse.json({
      success: true,
      message: 'Evaluation schema deployed successfully',
      tables: [
        'evaluation_sessions',
        'evaluation_files', 
        'evaluation_results'
      ],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Schema deployment error:', error)
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

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to deploy the evaluation schema',
    description: 'Creates evaluation_sessions, evaluation_files, and evaluation_results tables',
    tables: ['evaluation_sessions', 'evaluation_files', 'evaluation_results']
  })
}