import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'

export async function GET() {
  try {
    const pool = await getDbConnection()
    
    // Create evaluation_sessions table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_sessions' AND xtype='U')
      CREATE TABLE evaluation_sessions (
        id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        user_id NVARCHAR(255) NOT NULL,
        role_id UNIQUEIDENTIFIER NOT NULL,
        name NVARCHAR(200) NOT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'pending',
        total_files INT NOT NULL DEFAULT 0,
        processed_files INT NOT NULL DEFAULT 0,
        average_score DECIMAL(5,2) NULL,
        top_candidates INT DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        started_at DATETIME NULL,
        completed_at DATETIME NULL,
        error_message NVARCHAR(MAX) NULL,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      )
    `)

    // Create evaluation_files table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_files' AND xtype='U')
      CREATE TABLE evaluation_files (
        id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        session_id UNIQUEIDENTIFIER NOT NULL,
        file_name NVARCHAR(255) NOT NULL,
        file_size INT NOT NULL,
        file_url NVARCHAR(500) NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'pending',
        extracted_text NVARCHAR(MAX) NULL,
        parse_error NVARCHAR(MAX) NULL,
        uploaded_at DATETIME DEFAULT GETDATE(),
        processed_at DATETIME NULL,
        FOREIGN KEY (session_id) REFERENCES evaluation_sessions(id) ON DELETE CASCADE
      )
    `)

    // Create evaluation_results table (links to evaluation session)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_results' AND xtype='U')
      CREATE TABLE evaluation_results (
        id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        session_id UNIQUEIDENTIFIER NOT NULL,
        file_id UNIQUEIDENTIFIER NOT NULL,
        role_id UNIQUEIDENTIFIER NOT NULL,
        candidate_name NVARCHAR(255) NULL,
        candidate_email NVARCHAR(255) NULL,
        candidate_phone NVARCHAR(50) NULL,
        overall_score DECIMAL(5,2) NOT NULL,
        skills_score DECIMAL(5,2) NULL,
        experience_score DECIMAL(5,2) NULL,
        education_score DECIMAL(5,2) NULL,
        recommendations NVARCHAR(MAX) NULL,
        red_flags NVARCHAR(MAX) NULL,
        ai_analysis NVARCHAR(MAX) NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (session_id) REFERENCES evaluation_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (file_id) REFERENCES evaluation_files(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      )
    `)

    // Create indexes for better performance
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_evaluation_sessions_user_id')
      CREATE INDEX idx_evaluation_sessions_user_id ON evaluation_sessions(user_id)
    `)

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_evaluation_files_session_id')
      CREATE INDEX idx_evaluation_files_session_id ON evaluation_files(session_id)
    `)

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_evaluation_results_session_id')
      CREATE INDEX idx_evaluation_results_session_id ON evaluation_results(session_id)
    `)

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_evaluation_results_score')
      CREATE INDEX idx_evaluation_results_score ON evaluation_results(overall_score DESC)
    `)

    await pool.close()

    return NextResponse.json({
      success: true,
      message: 'Evaluation schema created successfully',
      tables: [
        'evaluation_sessions',
        'evaluation_files', 
        'evaluation_results'
      ]
    })
  } catch (error) {
    console.error('Schema creation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to create evaluation schema',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}