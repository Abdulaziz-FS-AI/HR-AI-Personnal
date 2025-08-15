import { NextRequest, NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'
import { getBlobStorageService } from '@/lib/azure/blob-storage'
import { getServiceBusService } from '@/lib/azure/service-bus'
import { HyperbolicService } from '@/lib/ai/hyperbolic-service'

interface HealthCheckResult {
  service: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  message: string
  responseTime?: number
  details?: any
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const startTime = Date.now()
  let pool = null
  
  try {
    // Check if environment variables are set
    const requiredEnvVars = ['AZURE_SQL_SERVER', 'AZURE_SQL_DATABASE', 'AZURE_SQL_USER', 'AZURE_SQL_PASSWORD']
    const missingVars = requiredEnvVars.filter(v => !process.env[v])
    
    if (missingVars.length > 0) {
      return {
        service: 'Azure SQL Database',
        status: 'unhealthy',
        message: `Missing environment variables: ${missingVars.join(', ')}`,
        responseTime: Date.now() - startTime
      }
    }
    
    // Try to connect and run a simple query
    pool = await getDbConnection()
    const result = await pool.request().query('SELECT 1 as healthcheck, GETDATE() as serverTime')
    
    // Check if key tables exist
    const tablesCheck = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE' 
      AND TABLE_NAME IN ('users', 'roles', 'evaluation_sessions', 'evaluation_files')
      ORDER BY TABLE_NAME
    `)
    
    await pool.close()
    
    return {
      service: 'Azure SQL Database',
      status: 'healthy',
      message: 'Database connection successful',
      responseTime: Date.now() - startTime,
      details: {
        server: process.env.AZURE_SQL_SERVER,
        database: process.env.AZURE_SQL_DATABASE,
        serverTime: result.recordset[0].serverTime,
        tablesFound: tablesCheck.recordset.map(r => r.TABLE_NAME),
        missingTables: ['users', 'roles', 'evaluation_sessions', 'evaluation_files']
          .filter(t => !tablesCheck.recordset.find(r => r.TABLE_NAME === t))
      }
    }
  } catch (error) {
    if (pool) {
      try { await pool.close() } catch {}
    }
    
    return {
      service: 'Azure SQL Database',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database connection failed',
      responseTime: Date.now() - startTime,
      details: {
        errorType: error instanceof Error ? error.name : 'Unknown',
        server: process.env.AZURE_SQL_SERVER ? 'Configured' : 'Not configured'
      }
    }
  }
}

async function checkBlobStorage(): Promise<HealthCheckResult> {
  const startTime = Date.now()
  
  try {
    // Check if environment variables are set
    if (!process.env.AZURE_STORAGE_ACCOUNT_NAME || !process.env.AZURE_STORAGE_ACCOUNT_KEY) {
      return {
        service: 'Azure Blob Storage',
        status: 'unhealthy',
        message: 'Missing storage credentials',
        responseTime: Date.now() - startTime,
        details: {
          accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME ? 'Configured' : 'Missing',
          accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY ? 'Configured' : 'Missing'
        }
      }
    }
    
    const blobService = getBlobStorageService()
    
    // Test by checking if a known blob exists (won't fail if it doesn't)
    const testBlobName = 'health-check-test.txt'
    const exists = await blobService.blobExists(testBlobName)
    
    // Try to generate a SAS URL (this validates credentials)
    const testUrl = await blobService.generateDownloadUrl(testBlobName, 1).catch(() => null)
    
    return {
      service: 'Azure Blob Storage',
      status: testUrl ? 'healthy' : 'degraded',
      message: testUrl ? 'Blob storage accessible' : 'Blob storage partially working',
      responseTime: Date.now() - startTime,
      details: {
        accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
        containerName: 'resumes',
        testBlobExists: exists,
        sasGenerationWorks: !!testUrl
      }
    }
  } catch (error) {
    return {
      service: 'Azure Blob Storage',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Blob storage connection failed',
      responseTime: Date.now() - startTime
    }
  }
}

async function checkServiceBus(): Promise<HealthCheckResult> {
  const startTime = Date.now()
  
  try {
    const serviceBus = getServiceBusService()
    
    // Check if Service Bus is configured
    if (!serviceBus.isServiceBusAvailable()) {
      return {
        service: 'Azure Service Bus',
        status: 'degraded',
        message: 'Service Bus not configured (optional service)',
        responseTime: Date.now() - startTime,
        details: {
          configured: !!process.env.AZURE_SERVICE_BUS_CONNECTION_STRING,
          note: 'Service Bus is optional - app will work without it'
        }
      }
    }
    
    // Try health check
    const isHealthy = await serviceBus.healthCheck()
    
    return {
      service: 'Azure Service Bus',
      status: isHealthy ? 'healthy' : 'degraded',
      message: isHealthy ? 'Service Bus connected' : 'Service Bus connection issues',
      responseTime: Date.now() - startTime,
      details: {
        available: serviceBus.isServiceBusAvailable(),
        queues: ['file-processing', 'ai-analysis', 'results-aggregation']
      }
    }
  } catch (error) {
    return {
      service: 'Azure Service Bus',
      status: 'degraded',
      message: 'Service Bus check failed (optional service)',
      responseTime: Date.now() - startTime,
      details: {
        note: 'Service Bus is optional - app will work without it',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

async function checkAIService(): Promise<HealthCheckResult> {
  const startTime = Date.now()
  
  try {
    // Check if API key is configured
    if (!process.env.HYPERBOLIC_API_KEY) {
      return {
        service: 'Hyperbolic AI',
        status: 'unhealthy',
        message: 'Missing HYPERBOLIC_API_KEY',
        responseTime: Date.now() - startTime
      }
    }
    
    // Create service instance
    const aiService = new HyperbolicService()
    
    // Make a minimal test request
    const testResponse = await fetch('https://api.hyperbolic.xyz/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.HYPERBOLIC_API_KEY}`
      }
    })
    
    const isHealthy = testResponse.ok
    
    return {
      service: 'Hyperbolic AI',
      status: isHealthy ? 'healthy' : 'degraded',
      message: isHealthy ? 'AI service accessible' : 'AI service connection issues',
      responseTime: Date.now() - startTime,
      details: {
        model: 'gpt-oss-120b',
        endpoint: 'https://api.hyperbolic.xyz/v1',
        apiKeyConfigured: true,
        testResponseStatus: testResponse.status
      }
    }
  } catch (error) {
    return {
      service: 'Hyperbolic AI',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'AI service check failed',
      responseTime: Date.now() - startTime
    }
  }
}

async function checkAuthentication(): Promise<HealthCheckResult> {
  const startTime = Date.now()
  
  const authConfig = {
    nextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    nextAuthUrl: process.env.NEXTAUTH_URL || 'Not set',
    googleOAuth: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
    microsoftOAuth: !!process.env.MICROSOFT_CLIENT_ID && !!process.env.MICROSOFT_CLIENT_SECRET
  }
  
  const isHealthy = authConfig.nextAuthSecret
  
  return {
    service: 'Authentication',
    status: isHealthy ? 'healthy' : 'unhealthy',
    message: isHealthy ? 'Auth configured' : 'Missing NEXTAUTH_SECRET',
    responseTime: Date.now() - startTime,
    details: authConfig
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  // Run all health checks in parallel
  const [database, blobStorage, serviceBus, aiService, authentication] = await Promise.all([
    checkDatabase(),
    checkBlobStorage(),
    checkServiceBus(),
    checkAIService(),
    checkAuthentication()
  ])
  
  const healthChecks = [database, blobStorage, serviceBus, aiService, authentication]
  
  // Determine overall health
  const hasUnhealthy = healthChecks.some(h => h.status === 'unhealthy')
  const hasDegraded = healthChecks.some(h => h.status === 'degraded')
  
  const overallStatus = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy'
  const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503
  
  return NextResponse.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    totalResponseTime: Date.now() - startTime,
    environment: process.env.NODE_ENV,
    services: healthChecks,
    summary: {
      healthy: healthChecks.filter(h => h.status === 'healthy').length,
      degraded: healthChecks.filter(h => h.status === 'degraded').length,
      unhealthy: healthChecks.filter(h => h.status === 'unhealthy').length,
      total: healthChecks.length
    },
    criticalIssues: healthChecks
      .filter(h => h.status === 'unhealthy')
      .map(h => `${h.service}: ${h.message}`),
    warnings: healthChecks
      .filter(h => h.status === 'degraded')
      .map(h => `${h.service}: ${h.message}`)
  }, { status: httpStatus })
}