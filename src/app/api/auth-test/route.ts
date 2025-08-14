import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Auth test endpoint called - NO AUTH IMPORT')
    
    // Test cookies manually without importing auth
    const cookies = Object.fromEntries(request.cookies.entries())
    const sessionCookies = Object.keys(cookies).filter(key => 
      key.includes('session') || key.includes('authjs') || key.includes('next-auth')
    )
    
    return NextResponse.json({
      success: true,
      message: 'Auth test endpoint working without auth import',
      cookies: {
        total: Object.keys(cookies).length,
        sessionCookies: sessionCookies,
        allCookieNames: Object.keys(cookies)
      },
      nextAuthVersion: '^5.0.0-beta.29',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Auth test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}