import { NextResponse } from "next/server"
import { getDbConnection } from "@/lib/db"

export async function GET() {
  try {
    // Test database connection
    const pool = await getDbConnection()
    
    // Test if users table exists
    const result = await pool.request().query(`
      SELECT COUNT(*) as tableExists 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'users'
    `)
    
    const tablesExist = result.recordset[0].tableExists > 0
    
    // Close connection
    await pool.close()
    
    return NextResponse.json({
      status: "healthy",
      database: "connected",
      usersTable: tablesExist ? "exists" : "missing",
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