import { NextResponse } from 'next/server'

// Test the exact same endpoint path as evaluations but simpler
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      message: 'Simple evaluation test endpoint works',
      data: [],
      pagination: {
        limit: 50,
        offset: 0,
        hasMore: false
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}