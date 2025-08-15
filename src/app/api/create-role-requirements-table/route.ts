import { NextRequest, NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db-config'

export async function POST() {
  let pool = null
  try {
    pool = await getDbConnection()

    // Check if table already exists
    const tableCheck = await pool.request().query(`
      SELECT COUNT(*) as tableExists 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'role_requirements'
    `)

    if (tableCheck.recordset[0].tableExists > 0) {
      return NextResponse.json({
        success: true,
        message: 'role_requirements table already exists',
        action: 'none'
      })
    }

    console.log('Creating role_requirements table...')

    // Create the table
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

    console.log('Table created, adding foreign key constraint...')

    // Add foreign key constraint
    await pool.request().query(`
      ALTER TABLE role_requirements 
      ADD CONSTRAINT FK_role_requirements_roles 
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    `)

    console.log('Foreign key constraint added successfully')

    // Verify table was created
    const verifyCheck = await pool.request().query(`
      SELECT COUNT(*) as tableExists 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'role_requirements'
    `)

    const success = verifyCheck.recordset[0].tableExists > 0

    return NextResponse.json({
      success,
      message: success ? 'role_requirements table created successfully' : 'Table creation failed',
      action: 'created',
      details: {
        tableCreated: success,
        foreignKeyAdded: success
      }
    })

  } catch (error) {
    console.error('Create role_requirements table error:', error)
    
    // If it's a foreign key error, the table might exist but constraint failed
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json({
        success: true,
        message: 'Table already exists (foreign key constraint may have failed)',
        action: 'exists',
        warning: error.message
      })
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      action: 'failed'
    }, { status: 500 })
  } finally {
    if (pool) {
      await pool.close()
    }
  }
}