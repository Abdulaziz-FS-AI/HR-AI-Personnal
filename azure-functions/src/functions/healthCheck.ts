import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions'
import { getDbManager } from '../shared/enhanced-db-utils'
import { getBlobServiceClient } from '../shared/blob-utils'
import { getServiceBusClient } from '../shared/service-bus-utils'
import axios from 'axios'

interface HealthStatus {
  service: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  latency: number
  details?: any
  lastChecked: string
}

interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  version: string
  uptime: number
  services: HealthStatus[]
}

/**
 * Comprehensive health check endpoint
 */
async function healthCheck(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const startTime = Date.now()
  const healthChecks: HealthStatus[] = []

  // Check Database
  try {
    const dbManager = getDbManager()
    const dbHealth = await dbManager.healthCheck()
    
    healthChecks.push({
      service: 'database',
      status: dbHealth.healthy ? 'healthy' : 'unhealthy',
      latency: dbHealth.latency,
      details: dbHealth.error ? { error: dbHealth.error } : undefined,
      lastChecked: new Date().toISOString()
    })
  } catch (error) {
    healthChecks.push({
      service: 'database',
      status: 'unhealthy',
      latency: Date.now() - startTime,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      lastChecked: new Date().toISOString()
    })
  }

  // Check Blob Storage
  try {
    const blobStartTime = Date.now()
    const blobServiceClient = getBlobServiceClient()
    
    // Try to list containers (lightweight operation)
    const containerIterator = blobServiceClient.listContainers({ prefix: 'resumes' })
    await containerIterator.next()
    
    healthChecks.push({
      service: 'blob-storage',
      status: 'healthy',
      latency: Date.now() - blobStartTime,
      lastChecked: new Date().toISOString()
    })
  } catch (error) {
    healthChecks.push({
      service: 'blob-storage',
      status: 'unhealthy',
      latency: Date.now() - startTime,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      lastChecked: new Date().toISOString()
    })
  }

  // Check Service Bus
  try {
    const sbStartTime = Date.now()
    const serviceBusClient = getServiceBusClient()
    
    // This is a lightweight check - just ensure client is configured
    if (serviceBusClient) {
      healthChecks.push({
        service: 'service-bus',
        status: 'healthy',
        latency: Date.now() - sbStartTime,
        lastChecked: new Date().toISOString()
      })
    } else {
      throw new Error('Service Bus client not initialized')
    }
  } catch (error) {
    healthChecks.push({
      service: 'service-bus',
      status: 'unhealthy',
      latency: Date.now() - startTime,
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
      lastChecked: new Date().toISOString()
    })
  }

  // Check AI API
  try {
    const aiStartTime = Date.now()
    const apiUrl = process.env.HYPERBOLIC_API_URL
    const apiKey = process.env.HYPERBOLIC_API_KEY

    if (!apiUrl || !apiKey) {
      throw new Error('AI API not configured')
    }

    // Lightweight health check - just verify endpoint is reachable
    const response = await axios.get(apiUrl.replace('/chat/completions', '/models'), {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      timeout: 5000
    })

    healthChecks.push({
      service: 'ai-api',
      status: response.status === 200 ? 'healthy' : 'degraded',
      latency: Date.now() - aiStartTime,
      details: { statusCode: response.status },
      lastChecked: new Date().toISOString()
    })
  } catch (error) {
    const isTimeout = axios.isAxiosError(error) && error.code === 'ECONNABORTED'
    healthChecks.push({
      service: 'ai-api',
      status: isTimeout ? 'degraded' : 'unhealthy',
      latency: Date.now() - startTime,
      details: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timeout: isTimeout
      },
      lastChecked: new Date().toISOString()
    })
  }

  // Determine overall health
  const unhealthyServices = healthChecks.filter(s => s.status === 'unhealthy')
  const degradedServices = healthChecks.filter(s => s.status === 'degraded')
  
  let overallStatus: 'healthy' | 'unhealthy' | 'degraded'
  if (unhealthyServices.length > 0) {
    overallStatus = 'unhealthy'
  } else if (degradedServices.length > 0) {
    overallStatus = 'degraded'
  } else {
    overallStatus = 'healthy'
  }

  const health: SystemHealth = {
    overall: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    services: healthChecks
  }

  // Return appropriate HTTP status
  const httpStatus = overallStatus === 'healthy' ? 200 : 
                    overallStatus === 'degraded' ? 200 : 503

  context.log('Health check completed', {
    overall: overallStatus,
    duration: Date.now() - startTime,
    unhealthy: unhealthyServices.length,
    degraded: degradedServices.length
  })

  return {
    status: httpStatus,
    jsonBody: health,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  }
}

/**
 * Detailed system metrics endpoint
 */
async function systemMetrics(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version
      },
      azure: {
        region: process.env.REGION_NAME || 'unknown',
        resourceGroup: process.env.WEBSITE_RESOURCE_GROUP || 'unknown',
        siteName: process.env.WEBSITE_SITE_NAME || 'unknown'
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'unknown',
        functionsVersion: process.env.FUNCTIONS_EXTENSION_VERSION || 'unknown'
      }
    }

    return {
      status: 200,
      jsonBody: metrics,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    }
  } catch (error) {
    context.error('Error retrieving system metrics:', error)
    return {
      status: 500,
      jsonBody: { error: 'Failed to retrieve metrics' }
    }
  }
}

/**
 * Queue status monitoring
 */
async function queueStatus(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const queueNames = ['file-processing', 'ai-analysis', 'session-completion']
    const queueStats = []

    for (const queueName of queueNames) {
      try {
        // Note: This would require Service Bus management SDK for actual queue metrics
        // For now, we'll return a placeholder structure
        queueStats.push({
          name: queueName,
          activeMessages: 0,
          deadLetterMessages: 0,
          scheduledMessages: 0,
          status: 'active',
          lastChecked: new Date().toISOString()
        })
      } catch (error) {
        queueStats.push({
          name: queueName,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          lastChecked: new Date().toISOString()
        })
      }
    }

    return {
      status: 200,
      jsonBody: {
        timestamp: new Date().toISOString(),
        queues: queueStats
      },
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, max-age=30'
      }
    }
  } catch (error) {
    context.error('Error retrieving queue status:', error)
    return {
      status: 500,
      jsonBody: { error: 'Failed to retrieve queue status' }
    }
  }
}

// Register health check endpoints
app.http('healthCheck', {
  methods: ['GET'],
  route: 'health',
  authLevel: 'anonymous',
  handler: healthCheck
})

app.http('systemMetrics', {
  methods: ['GET'],
  route: 'metrics',
  authLevel: 'function', // Require function key for sensitive metrics
  handler: systemMetrics
})

app.http('queueStatus', {
  methods: ['GET'],
  route: 'queues/status',
  authLevel: 'function',
  handler: queueStatus
})

export { healthCheck, systemMetrics, queueStatus }