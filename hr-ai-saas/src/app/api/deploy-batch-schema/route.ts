import { NextRequest, NextResponse } from 'next/server'
import { deployBatchSchema } from '@/lib/db-batch'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting batch processing schema deployment...')
    
    const success = await deployBatchSchema()
    
    if (!success) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to deploy batch processing schema' 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Batch processing schema deployed successfully',
      tables: [
        'batch_sessions - Tracks batch processing sessions',
        'resume_analysis_results - Stores AI analysis results'
      ]
    })

  } catch (error) {
    console.error('❌ Batch schema deployment error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Schema deployment failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to deploy batch processing schema',
    endpoint: '/api/deploy-batch-schema',
    method: 'POST'
  })
}