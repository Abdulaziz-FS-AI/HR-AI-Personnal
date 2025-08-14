import { NextRequest, NextResponse } from 'next/server'

// TEMPORARY SIMPLE VERSION TO TEST IF THIS FIXES THE 404
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Simple evaluations endpoint called')
    
    return NextResponse.json({
      success: true,
      message: 'Simple evaluations endpoint works!',
      data: [],
      pagination: {
        limit: 50,
        offset: 0,
        hasMore: false
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Evaluations endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Simple evaluations POST called')
    
    return NextResponse.json({
      success: true,
      message: 'Simple evaluations POST works!',
      data: { id: 'test-id' },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Evaluations POST error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}