import { NextRequest, NextResponse } from 'next/server'
import { BatchProcessor } from '@/lib/batch-processor'
import { auth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await params

    // Validate sessionId format for security
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 10) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      )
    }

    // Get batch processing status
    const status = await BatchProcessor.getBatchStatus(sessionId)

    if (!status) {
      return NextResponse.json(
        { error: 'Batch session not found' },
        { status: 404 }
      )
    }

    // SECURITY: Verify the session belongs to the authenticated user
    if (status.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied - session belongs to different user' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      status
    })

  } catch (error) {
    console.error('Error getting batch status:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}