import { NextRequest, NextResponse } from 'next/server'
import { BatchProcessor } from '@/lib/batch-processor'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { roleId } = body

    if (!roleId) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      )
    }

    // Start batch processing
    const sessionId = await BatchProcessor.startBatchProcessing(roleId, session.user.id)

    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Batch processing started successfully'
    })

  } catch (error) {
    console.error('Error starting batch processing:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}