import { NextRequest, NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db-config'

export async function POST() {
  try {
    const pool = await getDbConnection()

    // Complete schema deployment with all required tables
    const schema = `
      -- Users table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
      BEGIN
        CREATE TABLE users (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          email NVARCHAR(255) NOT NULL UNIQUE,
          password_hash NVARCHAR(255) NOT NULL,
          first_name NVARCHAR(100),
          last_name NVARCHAR(100),
          company_name NVARCHAR(200),
          phone NVARCHAR(20),
          is_active BIT DEFAULT 1,
          credits_remaining INT DEFAULT 1000,
          subscription_tier NVARCHAR(50) DEFAULT 'free',
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE(),
          last_login DATETIME2
        )
      END

      -- Roles table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U')
      BEGIN
        CREATE TABLE roles (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          user_id UNIQUEIDENTIFIER NOT NULL,
          title NVARCHAR(200) NOT NULL,
          description NVARCHAR(MAX),
          responsibilities NVARCHAR(MAX),
          department NVARCHAR(100),
          location NVARCHAR(100),
          employment_type NVARCHAR(50) DEFAULT 'full-time',
          seniority_level NVARCHAR(50) DEFAULT 'mid',
          min_experience_years INT DEFAULT 0,
          max_experience_years INT DEFAULT 10,
          education_requirements NVARCHAR(MAX),
          is_active BIT DEFAULT 1,
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE()
        )
      END

      -- Role Skills table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='role_skills' AND xtype='U')
      BEGIN
        CREATE TABLE role_skills (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          role_id UNIQUEIDENTIFIER NOT NULL,
          skill_name NVARCHAR(100) NOT NULL,
          weight INT NOT NULL CHECK (weight BETWEEN 1 AND 10),
          is_required BIT DEFAULT 0,
          created_at DATETIME2 DEFAULT GETDATE()
        )
      END

      -- Role Questions table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='role_questions' AND xtype='U')
      BEGIN
        CREATE TABLE role_questions (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          role_id UNIQUEIDENTIFIER NOT NULL,
          question_text NVARCHAR(MAX) NOT NULL,
          weight INT NOT NULL CHECK (weight BETWEEN 1 AND 10),
          expected_answer NVARCHAR(MAX),
          created_at DATETIME2 DEFAULT GETDATE()
        )
      END

      -- Role Requirements table (CRITICAL - was missing!)
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='role_requirements' AND xtype='U')
      BEGIN
        CREATE TABLE role_requirements (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          role_id UNIQUEIDENTIFIER NOT NULL,
          requirement_type NVARCHAR(50) NOT NULL,
          requirement_value NVARCHAR(MAX),
          is_required BIT DEFAULT 0,
          priority INT DEFAULT 5,
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE()
        )
      END

      -- Batch Sessions table (for evaluations)
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='batch_sessions' AND xtype='U')
      BEGIN
        CREATE TABLE batch_sessions (
          session_id NVARCHAR(100) PRIMARY KEY,
          user_id UNIQUEIDENTIFIER NOT NULL,
          role_id UNIQUEIDENTIFIER NOT NULL,
          total_files INT DEFAULT 0,
          processed_files INT DEFAULT 0,
          failed_files INT DEFAULT 0,
          started_at DATETIME2 DEFAULT GETDATE(),
          completed_at DATETIME2,
          status NVARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
        )
      END

      -- Evaluation Sessions table (newer structure)
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
          status NVARCHAR(50) DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'processing', 'completed', 'completed_with_errors', 'failed')),
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE(),
          completed_at DATETIME2
        )
      END

      -- Evaluation Files table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_files' AND xtype='U')
      BEGIN
        CREATE TABLE evaluation_files (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          evaluation_id UNIQUEIDENTIFIER NOT NULL,
          file_name NVARCHAR(255) NOT NULL,
          original_name NVARCHAR(255),
          file_size BIGINT,
          blob_name NVARCHAR(255),
          extracted_text NVARCHAR(MAX),
          contact_info NVARCHAR(MAX),
          processing_status NVARCHAR(50) DEFAULT 'pending',
          overall_score DECIMAL(5,2),
          created_at DATETIME2 DEFAULT GETDATE(),
          processed_at DATETIME2
        )
      END

      -- Evaluation Results table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_results' AND xtype='U')
      BEGIN
        CREATE TABLE evaluation_results (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          evaluation_id UNIQUEIDENTIFIER NOT NULL,
          file_id UNIQUEIDENTIFIER NOT NULL,
          overall_score DECIMAL(5,2) DEFAULT 0,
          skills_analysis NVARCHAR(MAX),
          questions_analysis NVARCHAR(MAX),
          recommendations NVARCHAR(MAX),
          red_flags NVARCHAR(MAX),
          summary NVARCHAR(MAX),
          ai_response NVARCHAR(MAX),
          tokens_used INT DEFAULT 0,
          created_at DATETIME2 DEFAULT GETDATE()
        )
      END

      -- Upload Sessions table (for file management)
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='upload_sessions' AND xtype='U')
      BEGIN
        CREATE TABLE upload_sessions (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          user_id UNIQUEIDENTIFIER NOT NULL,
          session_token NVARCHAR(100) UNIQUE NOT NULL,
          total_files INT DEFAULT 0,
          uploaded_files INT DEFAULT 0,
          failed_files INT DEFAULT 0,
          status NVARCHAR(50) DEFAULT 'active',
          expires_at DATETIME2 NOT NULL,
          created_at DATETIME2 DEFAULT GETDATE()
        )
      END

      -- Uploaded Files table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='uploaded_files' AND xtype='U')
      BEGIN
        CREATE TABLE uploaded_files (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          user_id UNIQUEIDENTIFIER NOT NULL,
          session_id UNIQUEIDENTIFIER,
          file_name NVARCHAR(255) NOT NULL,
          original_name NVARCHAR(255) NOT NULL,
          file_size BIGINT NOT NULL,
          mime_type NVARCHAR(100),
          blob_name NVARCHAR(255) NOT NULL,
          container_name NVARCHAR(100) DEFAULT 'resumes',
          extracted_text NVARCHAR(MAX),
          contact_info NVARCHAR(MAX),
          processing_status NVARCHAR(50) DEFAULT 'uploaded',
          tags NVARCHAR(MAX),
          notes NVARCHAR(MAX),
          created_at DATETIME2 DEFAULT GETDATE(),
          processed_at DATETIME2,
          last_accessed DATETIME2
        )
      END

      -- Analysis Results table (legacy support)
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='analysis_results' AND xtype='U')
      BEGIN
        CREATE TABLE analysis_results (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          file_id UNIQUEIDENTIFIER NOT NULL,
          session_id NVARCHAR(100),
          role_id UNIQUEIDENTIFIER,
          user_id UNIQUEIDENTIFIER NOT NULL,
          overall_score DECIMAL(5,2) DEFAULT 0,
          skills_analysis NVARCHAR(MAX),
          questions_analysis NVARCHAR(MAX),
          summary NVARCHAR(MAX),
          recommendations NVARCHAR(MAX),
          red_flags NVARCHAR(MAX),
          total_tokens_used INT DEFAULT 0,
          created_at DATETIME2 DEFAULT GETDATE()
        )
      END

      -- Add foreign key constraints after all tables are created
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_roles_users')
        ALTER TABLE roles ADD CONSTRAINT FK_roles_users FOREIGN KEY (user_id) REFERENCES users(id)
      
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_role_skills_roles')
        ALTER TABLE role_skills ADD CONSTRAINT FK_role_skills_roles FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_role_questions_roles')
        ALTER TABLE role_questions ADD CONSTRAINT FK_role_questions_roles FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_role_requirements_roles')
        ALTER TABLE role_requirements ADD CONSTRAINT FK_role_requirements_roles FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_batch_sessions_users')
        ALTER TABLE batch_sessions ADD CONSTRAINT FK_batch_sessions_users FOREIGN KEY (user_id) REFERENCES users(id)
      
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_batch_sessions_roles')
        ALTER TABLE batch_sessions ADD CONSTRAINT FK_batch_sessions_roles FOREIGN KEY (role_id) REFERENCES roles(id)
      
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_evaluation_sessions_users')
        ALTER TABLE evaluation_sessions ADD CONSTRAINT FK_evaluation_sessions_users FOREIGN KEY (user_id) REFERENCES users(id)
      
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_evaluation_sessions_roles')
        ALTER TABLE evaluation_sessions ADD CONSTRAINT FK_evaluation_sessions_roles FOREIGN KEY (role_id) REFERENCES roles(id)
      
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_evaluation_files_evaluation_sessions')
        ALTER TABLE evaluation_files ADD CONSTRAINT FK_evaluation_files_evaluation_sessions FOREIGN KEY (evaluation_id) REFERENCES evaluation_sessions(id) ON DELETE CASCADE
      
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_evaluation_results_evaluation_sessions')
        ALTER TABLE evaluation_results ADD CONSTRAINT FK_evaluation_results_evaluation_sessions FOREIGN KEY (evaluation_id) REFERENCES evaluation_sessions(id) ON DELETE CASCADE
      
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_evaluation_results_evaluation_files')
        ALTER TABLE evaluation_results ADD CONSTRAINT FK_evaluation_results_evaluation_files FOREIGN KEY (file_id) REFERENCES evaluation_files(id) ON DELETE CASCADE
      
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_upload_sessions_users')
        ALTER TABLE upload_sessions ADD CONSTRAINT FK_upload_sessions_users FOREIGN KEY (user_id) REFERENCES users(id)
      
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_uploaded_files_users')
        ALTER TABLE uploaded_files ADD CONSTRAINT FK_uploaded_files_users FOREIGN KEY (user_id) REFERENCES users(id)
      
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_uploaded_files_upload_sessions')
        ALTER TABLE uploaded_files ADD CONSTRAINT FK_uploaded_files_upload_sessions FOREIGN KEY (session_id) REFERENCES upload_sessions(id)
      
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_analysis_results_uploaded_files')
        ALTER TABLE analysis_results ADD CONSTRAINT FK_analysis_results_uploaded_files FOREIGN KEY (file_id) REFERENCES uploaded_files(id)
      
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_analysis_results_roles')
        ALTER TABLE analysis_results ADD CONSTRAINT FK_analysis_results_roles FOREIGN KEY (role_id) REFERENCES roles(id)
      
      IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_analysis_results_users')
        ALTER TABLE analysis_results ADD CONSTRAINT FK_analysis_results_users FOREIGN KEY (user_id) REFERENCES users(id)

      -- Indices for performance
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_users_email')
        CREATE UNIQUE INDEX IX_users_email ON users(email)

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_roles_user_id')
        CREATE INDEX IX_roles_user_id ON roles(user_id)

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_role_skills_role_id')
        CREATE INDEX IX_role_skills_role_id ON role_skills(role_id)

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_role_questions_role_id')
        CREATE INDEX IX_role_questions_role_id ON role_questions(role_id)

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_sessions_user_id')
        CREATE INDEX IX_evaluation_sessions_user_id ON evaluation_sessions(user_id)

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_files_evaluation_id')
        CREATE INDEX IX_evaluation_files_evaluation_id ON evaluation_files(evaluation_id)

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_uploaded_files_user_id')
        CREATE INDEX IX_uploaded_files_user_id ON uploaded_files(user_id)
    `

    await pool.request().query(schema)
    await pool.close()

    return NextResponse.json({
      success: true,
      message: 'Complete database schema deployed successfully',
      tables: [
        'users',
        'roles', 
        'role_skills',
        'role_questions',
        'batch_sessions',
        'evaluation_sessions',
        'evaluation_files', 
        'evaluation_results',
        'upload_sessions',
        'uploaded_files',
        'analysis_results'
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
    message: 'Use POST to deploy the complete database schema',
    endpoints: [
      'POST /api/deploy-complete-schema - Deploy all tables and indices',
      'GET /api/health - Check database and table status',
      'GET /api/check-schema - Verify table existence'
    ]
  })
}