import { NextResponse } from "next/server"
import { checkTablesExist, executeQuery } from "@/lib/db-utils"

export async function GET() {
  try {
    // Test database connection and check tables
    const tableStatus = await checkTablesExist(['users', 'roles', 'role_skills', 'role_questions', 'uploaded_files'])
    
    if (tableStatus === null) {
      throw new Error('Database connection failed')
    }
    
    // Count existing users (if table exists)
    let userCount = 0
    if (tableStatus.users) {
      const countResult = await executeQuery(async (pool) => {
        const result = await pool.request().query('SELECT COUNT(*) as count FROM users')
        return result.recordset[0].count
      })
      userCount = countResult || 0
    }
    
    return NextResponse.json({
      status: "healthy",
      database: "connected",
      tables: tableStatus,
      userCount: tableStatus.users ? userCount : "N/A (table missing)",
      schemaReady: Object.values(tableStatus).every(exists => exists),
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      { 
        status: "unhealthy",
        database: "connection_failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}