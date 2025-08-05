import { NextRequest, NextResponse } from "next/server"
import { getDbConnection } from "@/lib/db-config"

const createRoleQuestionsTable = `
CREATE TABLE role_questions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    role_id UNIQUEIDENTIFIER NOT NULL,
    question_text NTEXT NOT NULL,
    weight INT NOT NULL CHECK (weight >= 1 AND weight <= 10),
    category NVARCHAR(100),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);
`

const createIndexes = `
CREATE INDEX IX_role_questions_role_id ON role_questions(role_id);
`

export async function POST(request: NextRequest) {
  try {
    console.log('Extending database schema for role questions...')
    
    const pool = await getDbConnection()
    
    // Check if role_questions table already exists
    const checkTable = await pool.request().query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'role_questions'
    `)
    
    if (checkTable.recordset[0].count > 0) {
      await pool.close()
      return NextResponse.json({
        success: true,
        message: 'role_questions table already exists'
      })
    }
    
    // Create role_questions table
    console.log('Creating role_questions table...')
    await pool.request().query(createRoleQuestionsTable)
    
    console.log('Creating indexes...')
    await pool.request().query(createIndexes)
    
    console.log('Schema extension completed successfully!')
    
    return NextResponse.json({
      success: true,
      message: 'role_questions table created successfully'
    })
    
  } catch (error) {
    console.error('Schema extension error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Schema extension failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}