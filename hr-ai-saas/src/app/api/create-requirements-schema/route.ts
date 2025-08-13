import { NextResponse } from "next/server"
import { getDbConnection } from "@/lib/db"

export async function POST() {
  try {
    const pool = await getDbConnection()
    
    // Create role_requirements table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='role_requirements' AND xtype='U')
      CREATE TABLE role_requirements (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        role_id UNIQUEIDENTIFIER NOT NULL,
        requirement_text NVARCHAR(MAX) NOT NULL,
        weight INT NOT NULL CHECK (weight >= 1 AND weight <= 10),
        is_required BIT NOT NULL DEFAULT 0,
        category NVARCHAR(50) NOT NULL CHECK (category IN ('education', 'experience', 'other')),
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        
        -- Foreign key
        FOREIGN KEY (role_id) REFERENCES roles(id)
      )
    `)
    
    // Create indexes
    await pool.request().query(`
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_role_requirements_role_id')
        CREATE INDEX IX_role_requirements_role_id ON role_requirements (role_id);
        
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_role_requirements_category')
        CREATE INDEX IX_role_requirements_category ON role_requirements (category);
        
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_role_requirements_weight')
        CREATE INDEX IX_role_requirements_weight ON role_requirements (weight);
    `)

    // Verify table creation
    const tableCheckResult = await pool.request().query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'role_requirements'
    `)
    
    const tableExists = tableCheckResult.recordset[0].count > 0

    if (!tableExists) {
      throw new Error('Failed to create role_requirements table')
    }

    // Check for foreign key constraints (optional since we don't enforce referential integrity in this schema)
    const constraintCheckResult = await pool.request().query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_NAME = 'role_requirements'
      AND CONSTRAINT_TYPE = 'CHECK'
    `)

    return NextResponse.json({
      success: true,
      message: "Requirements schema deployed successfully",
      details: {
        tableCreated: tableExists,
        constraints: constraintCheckResult.recordset[0].count,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('Requirements schema deployment error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to deploy requirements schema",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}