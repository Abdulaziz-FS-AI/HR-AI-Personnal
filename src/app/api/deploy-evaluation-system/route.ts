import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'
import sql from 'mssql'

export async function POST() {
  let pool: sql.ConnectionPool | null = null
  const deploymentLog: string[] = []
  
  try {
    pool = await getDbConnection()
    deploymentLog.push('✅ Database connection established')
    
    // Step 1: Create evaluation_sessions table with correct constraints
    const createEvaluationSessions = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_sessions' AND xtype='U')
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
          created_at DATETIME2 DEFAULT GETDATE(),
          started_at DATETIME2 NULL,
          completed_at DATETIME2 NULL,
          updated_at DATETIME2 DEFAULT GETDATE(),
          error_message NVARCHAR(MAX) NULL
        )
        
        -- Add proper status constraint
        ALTER TABLE evaluation_sessions
        ADD CONSTRAINT CK_evaluation_sessions_status 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
      END
    `
    
    await pool.request().query(createEvaluationSessions)
    deploymentLog.push('✅ evaluation_sessions table created')

    // Step 2: Create evaluation_files table
    const createEvaluationFiles = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_files' AND xtype='U')
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
          uploaded_at DATETIME2 DEFAULT GETDATE(),
          processed_at DATETIME2 NULL
        )
        
        -- Add status constraint for files
        ALTER TABLE evaluation_files
        ADD CONSTRAINT CK_evaluation_files_status 
        CHECK (status IN ('uploaded', 'processing', 'completed', 'failed'))
      END
    `
    
    await pool.request().query(createEvaluationFiles)
    deploymentLog.push('✅ evaluation_files table created')

    // Step 3: Create evaluation_results table
    const createEvaluationResults = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_results' AND xtype='U')
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
          created_at DATETIME2 DEFAULT GETDATE()
        )
      END
    `
    
    await pool.request().query(createEvaluationResults)
    deploymentLog.push('✅ evaluation_results table created')

    // Step 4: Add Foreign Key Constraints (only if base tables exist)
    const checkBaseTables = await pool.request().query(`
      SELECT name FROM sysobjects 
      WHERE name IN ('users', 'roles') AND xtype='U'
    `)
    
    if (checkBaseTables.recordset.length === 2) {
      // Add foreign keys only if base tables exist
      const addForeignKeys = `
        -- Add FK to users table if not exists
        IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_evaluation_sessions_users')
          ALTER TABLE evaluation_sessions 
          ADD CONSTRAINT FK_evaluation_sessions_users 
          FOREIGN KEY (user_id) REFERENCES users(id)
        
        -- Add FK to roles table if not exists  
        IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_evaluation_sessions_roles')
          ALTER TABLE evaluation_sessions 
          ADD CONSTRAINT FK_evaluation_sessions_roles 
          FOREIGN KEY (role_id) REFERENCES roles(id)
        
        -- Add FK from files to sessions
        IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_evaluation_files_sessions')
          ALTER TABLE evaluation_files 
          ADD CONSTRAINT FK_evaluation_files_sessions 
          FOREIGN KEY (evaluation_id) REFERENCES evaluation_sessions(id) ON DELETE CASCADE
        
        -- Add FK from results to sessions
        IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_evaluation_results_sessions')
          ALTER TABLE evaluation_results 
          ADD CONSTRAINT FK_evaluation_results_sessions 
          FOREIGN KEY (evaluation_id) REFERENCES evaluation_sessions(id) ON DELETE CASCADE
        
        -- Add FK from results to files
        IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_evaluation_results_files')
          ALTER TABLE evaluation_results 
          ADD CONSTRAINT FK_evaluation_results_files 
          FOREIGN KEY (file_id) REFERENCES evaluation_files(id) ON DELETE CASCADE
      `
      
      await pool.request().query(addForeignKeys)
      deploymentLog.push('✅ Foreign key constraints added')
    } else {
      deploymentLog.push('⚠️ Base tables (users, roles) missing - skipping foreign keys')
    }

    // Step 5: Add Performance Indexes
    const createIndexes = `
      -- Indexes for better performance
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_sessions_user_id')
        CREATE INDEX IX_evaluation_sessions_user_id ON evaluation_sessions(user_id)
      
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_sessions_status')
        CREATE INDEX IX_evaluation_sessions_status ON evaluation_sessions(status)
      
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_files_evaluation_id')
        CREATE INDEX IX_evaluation_files_evaluation_id ON evaluation_files(evaluation_id)
      
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_files_status')
        CREATE INDEX IX_evaluation_files_status ON evaluation_files(status)
      
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_results_evaluation_id')
        CREATE INDEX IX_evaluation_results_evaluation_id ON evaluation_results(evaluation_id)
      
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evaluation_results_score')
        CREATE INDEX IX_evaluation_results_score ON evaluation_results(overall_score DESC)
    `
    
    await pool.request().query(createIndexes)
    deploymentLog.push('✅ Performance indexes created')

    // Step 6: Verify all tables exist
    const verifyTables = await pool.request().query(`
      SELECT name, create_date 
      FROM sys.tables 
      WHERE name IN ('evaluation_sessions', 'evaluation_files', 'evaluation_results')
      ORDER BY name
    `)
    
    deploymentLog.push(`✅ Verified ${verifyTables.recordset.length}/3 evaluation tables exist`)

    await pool.close()

    return NextResponse.json({
      success: true,
      message: 'Evaluation system deployed successfully',
      deploymentLog,
      tables: verifyTables.recordset,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Deployment error:', error)
    deploymentLog.push(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    if (pool) {
      await pool.close()
    }

    return NextResponse.json({
      success: false,
      message: 'Evaluation system deployment failed',
      deploymentLog,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to deploy the evaluation system',
    description: 'This endpoint will create all required tables, constraints, and indexes for the evaluation system',
    tables: ['evaluation_sessions', 'evaluation_files', 'evaluation_results'],
    features: ['Status constraints', 'Foreign keys', 'Performance indexes', 'Error handling']
  })
}