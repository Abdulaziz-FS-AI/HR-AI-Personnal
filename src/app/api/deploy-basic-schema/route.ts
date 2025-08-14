import { NextRequest, NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db-config'

export async function POST() {
  try {
    const pool = await getDbConnection()

    // Basic schema deployment - essential tables only
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
    `

    await pool.request().query(schema)
    await pool.close()

    return NextResponse.json({
      success: true,
      message: 'Basic database schema deployed successfully',
      tables: [
        'users',
        'roles', 
        'role_skills',
        'role_questions',
        'batch_sessions'
      ],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Basic schema deployment error:', error)
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
    message: 'Use POST to deploy the basic database schema',
    tables: ['users', 'roles', 'role_skills', 'role_questions', 'batch_sessions']
  })
}