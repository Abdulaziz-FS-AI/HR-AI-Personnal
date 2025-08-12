import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'

export async function GET() {
  const results = []
  
  try {
    const pool = await getDbConnection()
    
    // Create evaluation_sessions table without foreign keys first
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_sessions' AND xtype='U')
        CREATE TABLE evaluation_sessions (
          id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
          user_id UNIQUEIDENTIFIER NOT NULL,
          role_id UNIQUEIDENTIFIER NOT NULL,
          name NVARCHAR(255) NOT NULL,
          description NTEXT,
          status NVARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'processing', 'completed', 'failed')),
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
      results.push('evaluation_sessions table created/verified')
    } catch (error) {
      results.push(`evaluation_sessions table error: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
    
    // Create indexes for evaluation_sessions
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_sessions_user_id')
        CREATE INDEX IX_evaluation_sessions_user_id ON evaluation_sessions(user_id)
      `)
      results.push('IX_evaluation_sessions_user_id index created/verified')
    } catch (error) {
      results.push(`IX_evaluation_sessions_user_id index error: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
    
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_sessions_role_id')
        CREATE INDEX IX_evaluation_sessions_role_id ON evaluation_sessions(role_id)
      `)
      results.push('IX_evaluation_sessions_role_id index created/verified')
    } catch (error) {
      results.push(`IX_evaluation_sessions_role_id index error: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
    
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_sessions_status')
        CREATE INDEX IX_evaluation_sessions_status ON evaluation_sessions(status)
      `)
      results.push('IX_evaluation_sessions_status index created/verified')
    } catch (error) {
      results.push(`IX_evaluation_sessions_status index error: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
    
    // Create evaluation_files table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_files' AND xtype='U')
      CREATE TABLE evaluation_files (
        id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        evaluation_id UNIQUEIDENTIFIER NOT NULL,
        file_name NVARCHAR(500) NOT NULL,
        blob_name NVARCHAR(500) NOT NULL,
        file_size BIGINT NOT NULL,
        status NVARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        extracted_text NTEXT,
        candidate_info NVARCHAR(MAX),
        overall_score FLOAT,
        recommendation NTEXT,
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        processed_at DATETIME2,
        FOREIGN KEY (evaluation_id) REFERENCES evaluation_sessions(id) ON DELETE CASCADE
      )
    `)
    
    // Create indexes for evaluation_files
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_files_evaluation_id')
      CREATE INDEX IX_evaluation_files_evaluation_id ON evaluation_files(evaluation_id)
    `)
    
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_files_status')
      CREATE INDEX IX_evaluation_files_status ON evaluation_files(status)
    `)
    
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_files_overall_score')
      CREATE INDEX IX_evaluation_files_overall_score ON evaluation_files(overall_score DESC)
    `)
    
    // Create evaluation_results table
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
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (evaluation_id) REFERENCES evaluation_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (file_id) REFERENCES evaluation_files(id) ON DELETE CASCADE
      )
    `)
    
    // Create indexes for evaluation_results
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_results_evaluation_id')
      CREATE INDEX IX_evaluation_results_evaluation_id ON evaluation_results(evaluation_id)
    `)
    
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_results_file_id')
      CREATE UNIQUE INDEX IX_evaluation_results_file_id ON evaluation_results(file_id)
    `)
    
    // Add columns to existing tables if they don't exist
    
    // Check and add evaluation_id to uploaded_files table (for linking files to evaluations)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('uploaded_files') AND name = 'evaluation_id')
      ALTER TABLE uploaded_files ADD evaluation_id UNIQUEIDENTIFIER
    `)
    
    // Add index for evaluation_id in uploaded_files
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_uploaded_files_evaluation_id')
      CREATE INDEX IX_uploaded_files_evaluation_id ON uploaded_files(evaluation_id)
    `)
    
    // Create a view for evaluation session details
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_evaluation_session_details')
      DROP VIEW vw_evaluation_session_details
    `)
    
    await pool.request().query(`
      CREATE VIEW vw_evaluation_session_details AS
      SELECT 
        es.id,
        es.user_id,
        es.role_id,
        es.name,
        es.description,
        es.status,
        es.total_files,
        es.processed_files,
        es.failed_files,
        es.average_score,
        es.highest_score,
        es.lowest_score,
        es.created_at,
        es.started_at,
        es.completed_at,
        r.title as role_title,
        r.department,
        r.location,
        u.email as user_email,
        u.company_name,
        (SELECT COUNT(*) FROM evaluation_files WHERE evaluation_id = es.id AND status = 'completed') as completed_files,
        (SELECT COUNT(*) FROM evaluation_results WHERE evaluation_id = es.id) as total_results
      FROM evaluation_sessions es
      INNER JOIN roles r ON es.role_id = r.id
      INNER JOIN users u ON es.user_id = u.id
    `)
    
    // Create a view for top candidates per evaluation
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_top_candidates')
      DROP VIEW vw_top_candidates
    `)
    
    await pool.request().query(`
      CREATE VIEW vw_top_candidates AS
      SELECT 
        ef.evaluation_id,
        ef.id as file_id,
        ef.file_name,
        ef.overall_score,
        ef.recommendation,
        ef.candidate_info,
        er.summary,
        er.strengths,
        er.weaknesses,
        er.red_flags,
        er.suggested_interview_questions,
        ROW_NUMBER() OVER (PARTITION BY ef.evaluation_id ORDER BY ef.overall_score DESC) as rank
      FROM evaluation_files ef
      LEFT JOIN evaluation_results er ON ef.id = er.file_id
      WHERE ef.overall_score IS NOT NULL
    `)
    
    return NextResponse.json({
      success: true,
      message: 'Evaluation schema deployment completed',
      results,
      summary: {
        attempted: results.length,
        errors: results.filter(r => r.includes('error')).length,
        success: results.filter(r => !r.includes('error')).length
      }
    })
  } catch (error) {
    console.error('Error creating evaluation schema:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create evaluation schema',
        details: error instanceof Error ? error.message : 'Unknown error',
        results
      },
      { status: 500 }
    )
  }
}