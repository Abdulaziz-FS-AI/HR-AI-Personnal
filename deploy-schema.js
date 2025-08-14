/**
 * Emergency schema deployment script
 * Run with: node deploy-schema.js
 */

require('dotenv').config({ path: '.env.local' })
const sql = require('mssql')

async function deploySchema() {
  try {
    console.log('🚀 Starting emergency schema deployment...')
    
    const config = {
      server: process.env.AZURE_SQL_SERVER,
      database: process.env.AZURE_SQL_DATABASE,
      user: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD,
      options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true,
      },
      connectionTimeout: 30000,
      requestTimeout: 60000,
    }

    console.log('🔗 Connecting to Azure SQL Database...')
    const pool = await sql.connect(config)
    console.log('✅ Connected successfully!')

    const schemas = [
      // Users table
      `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
      CREATE TABLE users (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        email NVARCHAR(255) UNIQUE NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        company_name NVARCHAR(255) NULL,
        first_name NVARCHAR(100) NULL,
        last_name NVARCHAR(100) NULL,
        subscription_tier NVARCHAR(50) NOT NULL DEFAULT 'basic',
        credits_remaining INT NOT NULL DEFAULT 10,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        is_active BIT NOT NULL DEFAULT 1
      );
      `,
      
      // Roles table
      `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U')
      CREATE TABLE roles (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        title NVARCHAR(200) NOT NULL,
        description NTEXT NULL,
        responsibilities NTEXT NULL,
        department NVARCHAR(100) NULL,
        location NVARCHAR(100) NULL,
        employment_type NVARCHAR(50) NULL,
        seniority_level NVARCHAR(50) NULL,
        min_experience_years INT NULL,
        max_experience_years INT NULL,
        education_requirements NTEXT NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        is_active BIT NOT NULL DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      `,
      
      // Role skills table
      `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='role_skills' AND xtype='U')
      CREATE TABLE role_skills (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        role_id UNIQUEIDENTIFIER NOT NULL,
        skill_name NVARCHAR(100) NOT NULL,
        weight INT NOT NULL CHECK (weight >= 1 AND weight <= 10),
        is_required BIT NOT NULL DEFAULT 0,
        skill_category NVARCHAR(50) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      );
      `,
      
      // Role questions table
      `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='role_questions' AND xtype='U')
      CREATE TABLE role_questions (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        role_id UNIQUEIDENTIFIER NOT NULL,
        question_text NTEXT NOT NULL,
        weight INT NOT NULL CHECK (weight >= 1 AND weight <= 10),
        category NVARCHAR(50) NULL,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      );
      `,
      
      // Evaluation sessions table
      `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_sessions' AND xtype='U')
      CREATE TABLE evaluation_sessions (
        id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        user_id NVARCHAR(255) NOT NULL,
        role_id UNIQUEIDENTIFIER NOT NULL,
        name NVARCHAR(200) NOT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'pending',
        total_files INT NOT NULL DEFAULT 0,
        processed_files INT NOT NULL DEFAULT 0,
        failed_files INT NOT NULL DEFAULT 0,
        average_score DECIMAL(5,2) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        completed_at DATETIME2 NULL,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      );
      `,
      
      // Evaluation files table
      `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_files' AND xtype='U')
      CREATE TABLE evaluation_files (
        id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        session_id UNIQUEIDENTIFIER NOT NULL,
        file_name NVARCHAR(255) NOT NULL,
        file_size INT NOT NULL,
        file_url NVARCHAR(500) NOT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'uploaded',
        extracted_text NTEXT NULL,
        uploaded_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        processed_at DATETIME2 NULL,
        FOREIGN KEY (session_id) REFERENCES evaluation_sessions(id) ON DELETE CASCADE
      );
      `,
      
      // Evaluation results table
      `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_results' AND xtype='U')
      CREATE TABLE evaluation_results (
        id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        session_id UNIQUEIDENTIFIER NOT NULL,
        file_id UNIQUEIDENTIFIER NOT NULL,
        role_id UNIQUEIDENTIFIER NOT NULL,
        overall_score DECIMAL(5,2) NOT NULL,
        recommendations NTEXT NULL,
        red_flags NVARCHAR(MAX) NULL,
        ai_analysis NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        FOREIGN KEY (session_id) REFERENCES evaluation_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (file_id) REFERENCES evaluation_files(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      );
      `
    ]

    console.log('📋 Deploying database schemas...')
    
    for (let i = 0; i < schemas.length; i++) {
      const schema = schemas[i]
      const tableName = [
        'users', 'roles', 'role_skills', 'role_questions', 
        'evaluation_sessions', 'evaluation_files', 'evaluation_results'
      ][i]
      
      console.log(`🔧 Creating table: ${tableName}`)
      await pool.request().query(schema)
      console.log(`✅ Table created: ${tableName}`)
    }

    // Verify tables exist
    console.log('🔍 Verifying table creation...')
    const checkResult = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE' 
      AND TABLE_NAME IN ('users', 'roles', 'role_skills', 'role_questions', 'evaluation_sessions', 'evaluation_files', 'evaluation_results')
      ORDER BY TABLE_NAME
    `)
    
    const createdTables = checkResult.recordset.map(row => row.TABLE_NAME)
    console.log('📊 Tables successfully created:', createdTables)

    await pool.close()
    
    console.log('')
    console.log('🎉 DATABASE SCHEMA DEPLOYMENT COMPLETE!')
    console.log('✅ All tables ready for evaluation processing')
    console.log('')
    console.log('🚀 Next step: Test your evaluation with 4 PDF files!')
    
  } catch (error) {
    console.error('❌ Schema deployment failed:', error)
    process.exit(1)
  }
}

deploySchema()