import { NextRequest, NextResponse } from 'next/server'
import { getConfigManager } from '@/lib/azure-config'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Check authentication - only authenticated users can refresh config
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const configManager = getConfigManager()
    const config = await configManager.refreshConfiguration()
    
    // Only return public configuration (no secrets)
    const publicConfig = await configManager.getPublicConfiguration()
    
    return NextResponse.json({
      success: true,
      message: 'Configuration refreshed successfully',
      timestamp: new Date().toISOString(),
      configKeys: Object.keys(config),
      publicConfig
    })
  } catch (error) {
    console.error('Configuration refresh failed:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Configuration refresh failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}