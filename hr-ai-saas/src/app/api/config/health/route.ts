import { NextRequest, NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/azure-config'

export async function GET(request: NextRequest) {
  try {
    const configManager = getConfigManager()
    const isHealthy = await configManager.isHealthy()
    
    const status = isHealthy ? 200 : 503
    const message = isHealthy ? 'Azure App Configuration is healthy' : 'Azure App Configuration is unhealthy'
    
    return NextResponse.json(
      { 
        healthy: isHealthy,
        message,
        timestamp: new Date().toISOString(),
        service: 'Azure App Configuration'
      },
      { status }
    )
  } catch (error) {
    console.error('Configuration health check failed:', error)
    
    return NextResponse.json(
      { 
        healthy: false,
        message: 'Configuration health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        service: 'Azure App Configuration'
      },
      { status: 503 }
    )
  }
}