import { NextResponse } from "next/server"
import { checkTablesExist, executeQuery } from "@/lib/db-utils"
import { checkDbHealth } from "@/lib/db"
import { getServiceBusService } from "@/lib/azure/service-bus"
import { getBlobStorageService } from "@/lib/azure/blob-storage"

export const dynamic = 'force-dynamic'

interface HealthCheck {
  service: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime: number
  details?: any
  error?: string
}

async function checkServiceBusHealth(): Promise<HealthCheck> {
  const startTime = Date.now()
  try {
    const serviceBus = getServiceBusService()
    const isHealthy = await serviceBus.healthCheck()
    const responseTime = Date.now() - startTime
    
    return {
      service: 'service-bus',
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime,
      details: {
        region: 'Switzerland North',
        namespace: process.env.AZURE_SERVICE_BUS_NAMESPACE || 'hr-ai-saas-sb-swissnorth',
        queues: ['file-processing', 'ai-analysis', 'results-aggregation', 'evaluation-queue']
      }
    }
  } catch (error) {
    return {
      service: 'service-bus',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function checkBlobStorageHealth(): Promise<HealthCheck> {
  const startTime = Date.now()
  try {
    const blobService = getBlobStorageService()
    const testBlob = 'health-check-test.txt'
    
    await blobService.blobExists(testBlob)
    const responseTime = Date.now() - startTime
    
    return {
      service: 'blob-storage',
      status: 'healthy',
      responseTime,
      details: {
        accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || 'hraisaas1754119004',
        region: 'Switzerland North',
        container: 'resumes'
      }
    }
  } catch (error) {
    return {
      service: 'blob-storage',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function GET() {
  const startTime = Date.now()
  
  try {
    // Run enhanced database check with connection pooling info
    const dbHealth = await checkDbHealth()
    const tableStatus = await checkTablesExist(['users', 'roles', 'role_skills', 'role_questions'])
    
    // Count existing users (if table exists)
    let userCount = 0
    if (tableStatus?.users) {
      const countResult = await executeQuery(async (pool) => {
        const result = await pool.request().query('SELECT COUNT(*) as count FROM users')
        return result.recordset[0].count
      })
      userCount = countResult || 0
    }

    // Run Azure service checks in parallel
    const [serviceBusCheck, blobStorageCheck] = await Promise.all([
      checkServiceBusHealth(),
      checkBlobStorageHealth()
    ])

    const dbCheck: HealthCheck = {
      service: 'database',
      status: dbHealth.connected ? 'healthy' : 'unhealthy',
      responseTime: Date.now() - startTime,
      details: {
        server: process.env.AZURE_SQL_SERVER,
        database: process.env.AZURE_SQL_DATABASE,
        region: 'Switzerland North',
        poolSize: dbHealth.poolSize,
        userCount,
        tablesReady: tableStatus ? Object.values(tableStatus).every(exists => exists) : false
      },
      error: dbHealth.error
    }

    const checks = [dbCheck, serviceBusCheck, blobStorageCheck]
    
    // Calculate summary
    const summary = {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length
    }

    // Determine overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
    if (summary.unhealthy > 0) {
      overallStatus = summary.unhealthy === summary.total ? 'unhealthy' : 'degraded'
    }

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      region: 'Switzerland North',
      migration: {
        completed: true,
        serviceBus: 'hr-ai-saas-sb-swissnorth',
        storageAccount: 'hraisaas1754119004',
        sqlServer: 'hr-ai-saas-server'
      },
      checks,
      summary,
      // Legacy fields for backward compatibility
      database: dbHealth.connected ? "connected" : "connection_failed",
      tables: tableStatus,
      userCount: tableStatus?.users ? userCount : "N/A (table missing)",
      schemaReady: tableStatus ? Object.values(tableStatus).every(exists => exists) : false
    }

    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 207 : 503

    return NextResponse.json(response, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      { 
        status: "unhealthy",
        database: "connection_failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      },
      { status: 503 }
    )
  }
}