import { NextResponse } from "next/server"
import { getDbConnection } from "@/lib/db"

export async function POST() {
  try {
    const pool = await getDbConnection()
    
    // Create users table if it doesn't exist
    await pool.request().query(`
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
      
      -- Create indexes if they don't exist
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_users_email')
        CREATE INDEX IX_users_email ON users (email);
      
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_users_company')
        CREATE INDEX IX_users_company ON users (company_name);
    `)

    // Verify table creation
    const tableCheckResult = await pool.request().query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'users'
    `)
    
    const tableExists = tableCheckResult.recordset[0].count > 0

    if (!tableExists) {
      throw new Error('Failed to create users table')
    }

    return NextResponse.json({
      success: true,
      message: "Users schema deployed successfully",
      details: {
        tableCreated: tableExists,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('Users schema deployment error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to deploy users schema",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}