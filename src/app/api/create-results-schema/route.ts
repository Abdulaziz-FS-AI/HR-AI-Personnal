import { NextRequest, NextResponse } from 'next/server'
import sql from 'mssql'
import { getServerConfig } from '@/lib/db-config'

export async function POST(request: NextRequest) {
  try {
    console.log('Creating results schema...')
    
    const config = getServerConfig()
    const pool = await sql.connect(config)

    // Create batch_sessions table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='batch_sessions' AND xtype='U')
      CREATE TABLE batch_sessions (
        id NVARCHAR(255) PRIMARY KEY,
        user_id NVARCHAR(255) NOT NULL,
        role_id NVARCHAR(255) NOT NULL,
        total_files INT NOT NULL DEFAULT 0,
        processed_files INT NOT NULL DEFAULT 0,
        failed_files INT NOT NULL DEFAULT 0,
        started_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        completed_at DATETIME2 NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
      )
    `)

    // Create resume_analysis_results table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='resume_analysis_results' AND xtype='U')
      CREATE TABLE resume_analysis_results (
        id NVARCHAR(255) PRIMARY KEY DEFAULT NEWID(),
        file_id NVARCHAR(255) NOT NULL,
        role_id NVARCHAR(255) NOT NULL,
        user_id NVARCHAR(255) NOT NULL,
        batch_session_id NVARCHAR(255) NULL,
        overall_score INT NOT NULL DEFAULT 0,
        summary NTEXT NULL,
        recommendations NTEXT NULL,
        red_flags NTEXT NULL,
        total_tokens_used INT NOT NULL DEFAULT 0,
        analysis_completed_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
      )
    `)

    // Create skills_analysis table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='skills_analysis' AND xtype='U')
      CREATE TABLE skills_analysis (
        id NVARCHAR(255) PRIMARY KEY DEFAULT NEWID(),
        analysis_result_id NVARCHAR(255) NOT NULL,
        skill_name NVARCHAR(255) NOT NULL,
        skill_category NVARCHAR(100) NULL,
        found BIT NOT NULL DEFAULT 0,
        confidence INT NOT NULL DEFAULT 0,
        evidence NTEXT NULL,
        weight INT NOT NULL DEFAULT 5,
        is_required BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE()
      )
    `)

    // Create questions_analysis table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='questions_analysis' AND xtype='U')
      CREATE TABLE questions_analysis (
        id NVARCHAR(255) PRIMARY KEY DEFAULT NEWID(),
        analysis_result_id NVARCHAR(255) NOT NULL,
        question_text NTEXT NOT NULL,
        question_category NVARCHAR(100) NULL,
        answer NTEXT NULL,
        score INT NOT NULL DEFAULT 0,
        confidence INT NOT NULL DEFAULT 0,
        weight INT NOT NULL DEFAULT 5,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE()
      )
    `)

    // Create indexes for better performance
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_resume_analysis_results_file_id')
      CREATE INDEX IX_resume_analysis_results_file_id ON resume_analysis_results(file_id)
    `)

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_resume_analysis_results_role_id')
      CREATE INDEX IX_resume_analysis_results_role_id ON resume_analysis_results(role_id)
    `)

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_resume_analysis_results_user_id')
      CREATE INDEX IX_resume_analysis_results_user_id ON resume_analysis_results(user_id)
    `)

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_skills_analysis_result_id')
      CREATE INDEX IX_skills_analysis_result_id ON skills_analysis(analysis_result_id)
    `)

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_questions_analysis_result_id')
      CREATE INDEX IX_questions_analysis_result_id ON questions_analysis(analysis_result_id)
    `)

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_batch_sessions_user_role')
      CREATE INDEX IX_batch_sessions_user_role ON batch_sessions(user_id, role_id)
    `)

    // Create view for complete results
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_complete_analysis_results')
      DROP VIEW vw_complete_analysis_results
    `)

    await pool.request().query(`
      CREATE VIEW vw_complete_analysis_results AS
      SELECT 
        r.id as analysis_id,
        r.file_id,
        r.role_id,
        r.user_id,
        r.batch_session_id,
        r.overall_score,
        r.summary,
        r.recommendations,
        r.red_flags,
        r.total_tokens_used,
        r.analysis_completed_at,
        f.file_name,
        f.file_size,
        f.uploaded_at,
        ro.role_name,
        ro.description as role_description,
        (
          SELECT COUNT(*) 
          FROM skills_analysis sa 
          WHERE sa.analysis_result_id = r.id AND sa.found = 1
        ) as skills_found_count,
        (
          SELECT COUNT(*) 
          FROM skills_analysis sa 
          WHERE sa.analysis_result_id = r.id
        ) as total_skills_count,
        (
          SELECT AVG(CAST(qa.score as FLOAT)) 
          FROM questions_analysis qa 
          WHERE qa.analysis_result_id = r.id
        ) as avg_question_score
      FROM resume_analysis_results r
      LEFT JOIN uploaded_files f ON r.file_id = f.id
      LEFT JOIN roles ro ON r.role_id = ro.id
    `)

    await pool.close()

    return NextResponse.json({
      success: true,
      message: 'Results schema created successfully',
      tables: [
        'batch_sessions',
        'resume_analysis_results', 
        'skills_analysis',
        'questions_analysis'
      ],
      views: ['vw_complete_analysis_results']
    })

  } catch (error) {
    console.error('Schema creation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}