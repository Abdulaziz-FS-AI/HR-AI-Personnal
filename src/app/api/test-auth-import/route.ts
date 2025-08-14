import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing auth import without calling it')
    
    // Test if we can import the auth module without calling it
    const authModule = await import('@/lib/auth')
    
    return NextResponse.json({
      success: true,
      message: 'Auth import test successful',
      authModuleKeys: Object.keys(authModule),
      hasAuth: 'auth' in authModule,
      hasHandlers: 'handlers' in authModule,
      authType: typeof authModule.auth,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Auth import test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}