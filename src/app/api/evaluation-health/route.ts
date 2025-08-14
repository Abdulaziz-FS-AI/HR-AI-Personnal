import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'
import sql from 'mssql'

interface TableStatus {
  name: string
  exists: boolean
  rowCount?: number
  lastActivity?: string
}

interface HealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  database: {
    connected: boolean
    server: string
  }
  tables: TableStatus[]
  evaluation_system: {
    ready: boolean
    missing_tables: string[]
    recommendations: string[]
  }
  recent_activity: {
    sessions_24h: number
    files_24h: number
    results_24h: number
  }
}

export async function GET() {
  let pool: sql.ConnectionPool | null = null
  
  try {
    pool = await getDbConnection()
    
    const report: HealthReport = {
      overall: 'healthy',
      database: {
        connected: true,
        server: process.env.DB_SERVER?.split('.')[0] || 'unknown'
      },
      tables: [],
      evaluation_system: {
        ready: false,
        missing_tables: [],
        recommendations: []
      },
      recent_activity: {
        sessions_24h: 0,
        files_24h: 0,
        results_24h: 0
      }
    }

    // Check required tables
    const requiredTables = ['users', 'roles', 'evaluation_sessions', 'evaluation_files', 'evaluation_results']
    
    for (const tableName of requiredTables) {
      const tableCheck = await pool.request().query(`
        SELECT name FROM sysobjects 
        WHERE name='${tableName}' AND xtype='U'
      `)
      
      const exists = tableCheck.recordset.length > 0
      const tableStatus: TableStatus = {
        name: tableName,
        exists
      }
      
      if (exists) {
        try {
          // Get row count for existing tables
          const countResult = await pool.request().query(`SELECT COUNT(*) as count FROM ${tableName}`)
          tableStatus.rowCount = countResult.recordset[0].count
          
          // Get last activity for activity tables
          if (['evaluation_sessions', 'evaluation_files', 'evaluation_results'].includes(tableName)) {
            const activityResult = await pool.request().query(`
              SELECT TOP 1 created_at 
              FROM ${tableName} 
              ORDER BY created_at DESC
            `)
            if (activityResult.recordset.length > 0) {
              tableStatus.lastActivity = activityResult.recordset[0].created_at
            }
          }
        } catch (error) {
          console.warn(`Failed to get stats for ${tableName}:`, error)
        }
      } else {
        report.evaluation_system.missing_tables.push(tableName)
      }
      
      report.tables.push(tableStatus)
    }

    // Check evaluation system readiness
    const evaluationTables = ['evaluation_sessions', 'evaluation_files', 'evaluation_results']
    const evaluationTablesExist = report.tables
      .filter(t => evaluationTables.includes(t.name))
      .every(t => t.exists)
    
    report.evaluation_system.ready = evaluationTablesExist

    // Get recent activity (if tables exist)
    if (evaluationTablesExist) {
      try {
        const sessionActivity = await pool.request().query(`
          SELECT COUNT(*) as count 
          FROM evaluation_sessions 
          WHERE created_at >= DATEADD(day, -1, GETDATE())
        `)
        report.recent_activity.sessions_24h = sessionActivity.recordset[0].count

        const fileActivity = await pool.request().query(`
          SELECT COUNT(*) as count 
          FROM evaluation_files 
          WHERE uploaded_at >= DATEADD(day, -1, GETDATE())
        `)
        report.recent_activity.files_24h = fileActivity.recordset[0].count

        const resultActivity = await pool.request().query(`
          SELECT COUNT(*) as count 
          FROM evaluation_results 
          WHERE created_at >= DATEADD(day, -1, GETDATE())
        `)
        report.recent_activity.results_24h = resultActivity.recordset[0].count
      } catch (error) {
        console.warn('Failed to get recent activity:', error)
      }
    }

    // Generate recommendations
    if (!report.evaluation_system.ready) {
      report.overall = 'unhealthy'
      report.evaluation_system.recommendations.push(
        'Run POST /api/deploy-evaluation-system to create missing tables'
      )
    }

    const baseTables = ['users', 'roles']
    const baseTablesExist = report.tables
      .filter(t => baseTables.includes(t.name))
      .every(t => t.exists)
    
    if (!baseTablesExist) {
      report.overall = 'unhealthy'
      report.evaluation_system.recommendations.push(
        'Run POST /api/deploy-basic-schema to create base tables first'
      )
    }

    if (report.evaluation_system.ready && report.recent_activity.sessions_24h === 0) {
      report.overall = 'degraded'
      report.evaluation_system.recommendations.push(
        'No recent evaluation activity - system ready but unused'
      )
    }

    await pool.close()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...report
    })

  } catch (error) {
    console.error('Health check error:', error)
    
    if (pool) {
      await pool.close()
    }

    return NextResponse.json({
      success: false,
      overall: 'unhealthy',
      database: {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      },
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST() {
  // Auto-fix endpoint - deploy missing components
  let pool: sql.ConnectionPool | null = null
  
  try {
    pool = await getDbConnection()
    
    const fixes: string[] = []
    
    // Check what's missing and fix automatically
    const healthCheck = await GET()
    const healthData = await healthCheck.json()
    
    if (!healthData.success) {
      throw new Error('Cannot perform auto-fix - database connection failed')
    }

    // Auto-deploy missing tables
    if (!healthData.evaluation_system.ready) {
      fixes.push('Deploying evaluation system tables...')
      
      // Call the deployment endpoint internally
      const response = await fetch('https://hr-ai-personnal.vercel.app/api/deploy-evaluation-system', {
        method: 'POST'
      })
      
      if (response.ok) {
        fixes.push('✅ Evaluation system deployed successfully')
      } else {
        const error = await response.text()
        fixes.push(`❌ Failed to deploy evaluation system: ${error}`)
      }
    }

    await pool.close()

    return NextResponse.json({
      success: true,
      message: 'Auto-fix completed',
      fixes,
      recommendation: 'Run GET /api/evaluation-health to verify fixes',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Auto-fix error:', error)
    
    if (pool) {
      await pool.close()
    }

    return NextResponse.json({
      success: false,
      message: 'Auto-fix failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}