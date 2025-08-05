import { NextResponse } from "next/server"
import { getDbConnection } from "@/lib/db-config"

export async function POST() {
  try {
    const pool = await getDbConnection()
    
    // Create users table if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
      CREATE TABLE users (
        id NVARCHAR(50) PRIMARY KEY DEFAULT NEWID(),
        email NVARCHAR(255) UNIQUE NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        company_name NVARCHAR(255) NULL,
        first_name NVARCHAR(100) NULL,
        last_name NVARCHAR(100) NULL,
        credits_remaining INT DEFAULT 1000,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NULL,
        
        -- Indexes for performance
        INDEX IX_users_email (email),
        INDEX IX_users_company (company_name)
      )
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