import { NextRequest, NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db-config'

export async function POST() {
  let pool = null
  try {
    pool = await getDbConnection()

    // First, check if role_requirements table exists
    const tableCheck = await pool.request().query(`
      SELECT COUNT(*) as exists 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'role_requirements'
    `)

    const tableExists = tableCheck.recordset[0].exists > 0

    if (tableExists) {
      return NextResponse.json({
        success: true,
        message: 'role_requirements table already exists',
        tableExists: true
      })
    }

    // Create the table with simple structure first
    await pool.request().query(`
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
    `)

    // Add foreign key constraint separately
    await pool.request().query(`
      ALTER TABLE role_requirements 
      ADD CONSTRAINT FK_role_requirements_roles 
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    `)

    return NextResponse.json({
      success: true,
      message: 'role_requirements table created successfully',
      tableExists: false,
      created: true
    })

  } catch (error) {
    console.error('Debug role requirements error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      tableExists: false
    }, { status: 500 })
  } finally {
    if (pool) {
      await pool.close()
    }
  }
}