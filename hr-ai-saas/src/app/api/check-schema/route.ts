import { NextRequest, NextResponse } from "next/server"
import { getDbConnection } from "@/lib/db-config"

export async function GET(request: NextRequest) {
  try {
    const pool = await getDbConnection()
    
    // Check if role_questions table exists
    const result = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME IN ('roles', 'role_skills', 'role_questions')
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `)
    
    const tables = result.recordset.reduce((acc, row) => {
      if (!acc[row.TABLE_NAME]) {
        acc[row.TABLE_NAME] = []
      }
      acc[row.TABLE_NAME].push({
        column: row.COLUMN_NAME,
        type: row.DATA_TYPE,
        nullable: row.IS_NULLABLE === 'YES'
      })
      return acc
    }, {})
    
    return NextResponse.json({
      success: true,
      tables: tables
    })
    
  } catch (error) {
    console.error('Database schema check error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}