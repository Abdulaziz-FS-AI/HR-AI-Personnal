import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Simple auth test endpoint called - no imports')
    
    // Test basic functionality without imports
    return NextResponse.json({
      success: true,
      message: 'Simple auth test endpoint working',
      timestamp: new Date().toISOString(),
      test: 'Basic routing works'
    })
  } catch (error) {
    console.error('Simple auth test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}