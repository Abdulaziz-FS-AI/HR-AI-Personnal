import { NextResponse } from "next/server"
import { executeQueryStrict, checkTablesExist } from "@/lib/db-utils"

export async function POST() {
  try {
    // Check if tables already exist
    const existingTables = await checkTablesExist(['users', 'roles', 'role_skills', 'role_questions', 'uploaded_files'])
    
    // Create all tables in the correct order due to foreign key relationships
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
        subscription_tier NVARCHAR(50) DEFAULT 'basic',
        credits_remaining INT DEFAULT 10,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updated_at DATETIME2 NULL,
        is_active BIT DEFAULT 1
      );
      `,
      
      // Roles table
      `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U')
      CREATE TABLE roles (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        title NVARCHAR(255) NOT NULL,
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
        is_active BIT DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      `,
      
      // Role Skills table
      `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='role_skills' AND xtype='U')
      CREATE TABLE role_skills (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        role_id UNIQUEIDENTIFIER NOT NULL,
        skill_name NVARCHAR(255) NOT NULL,
        weight INT NOT NULL CHECK (weight >= 1 AND weight <= 10),
        is_required BIT DEFAULT 0,
        skill_category NVARCHAR(100) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      );
      `,
      
      // Role Questions table
      `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='role_questions' AND xtype='U')
      CREATE TABLE role_questions (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        role_id UNIQUEIDENTIFIER NOT NULL,
        question_text NTEXT NOT NULL,
        weight INT NOT NULL CHECK (weight >= 1 AND weight <= 10),
        category NVARCHAR(100) NULL,
        is_active BIT DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      );
      `,
      
      // Uploaded Files table
      `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='uploaded_files' AND xtype='U')
      CREATE TABLE uploaded_files (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        filename NVARCHAR(255) NOT NULL,
        original_filename NVARCHAR(255) NOT NULL,
        file_size INT NOT NULL,
        content_type NVARCHAR(100) NOT NULL,
        blob_url NVARCHAR(500) NOT NULL,
        status NVARCHAR(50) DEFAULT 'uploaded',
        extracted_text NTEXT NULL,
        extraction_confidence FLOAT NULL,
        processing_notes NTEXT NULL,
        tags NVARCHAR(500) NULL,
        notes NTEXT NULL,
        is_archived BIT DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      `,
      
      // Indexes
      `
      -- Create indexes if they don't exist
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_users_email')
        CREATE INDEX IX_users_email ON users (email);
      
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_users_company')
        CREATE INDEX IX_users_company ON users (company_name);
        
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_roles_user_id')
        CREATE INDEX IX_roles_user_id ON roles (user_id);
        
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_role_skills_role_id')
        CREATE INDEX IX_role_skills_role_id ON role_skills (role_id);
        
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_role_questions_role_id')
        CREATE INDEX IX_role_questions_role_id ON role_questions (role_id);
        
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_uploaded_files_user_id')
        CREATE INDEX IX_uploaded_files_user_id ON uploaded_files (user_id);
        
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_uploaded_files_status')
        CREATE INDEX IX_uploaded_files_status ON uploaded_files (status);
      `
    ]
    
    // Execute each schema creation
    for (let i = 0; i < schemas.length; i++) {
      await executeQueryStrict(async (pool) => {
        return await pool.request().query(schemas[i])
      })
    }
    
    // Verify all tables were created
    const finalTables = await checkTablesExist(['users', 'roles', 'role_skills', 'role_questions', 'uploaded_files'])
    const expectedTables = ['roles', 'role_questions', 'role_skills', 'uploaded_files', 'users']
    const allTablesCreated = expectedTables.every(table => finalTables[table])

    return NextResponse.json({
      success: true,
      message: "Complete database schema deployed successfully",
      details: {
        existingBeforeDeployment: existingTables,
        finalTableStatus: finalTables,
        allTablesCreated,
        expectedTables,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('Schema deployment error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to deploy database schema",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}