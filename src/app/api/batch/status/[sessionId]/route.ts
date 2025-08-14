import { NextRequest, NextResponse } from 'next/server'
import { requireUserContext, logDataAccess } from '@/lib/security/user-context'
import { withRateLimit } from '@/lib/security/rate-limit'
import { getUserBatchSession } from '@/lib/db-secure'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Authenticate user and get secure context
    const userContext = await requireUserContext(request)
    
    // Apply rate limiting
    const rateLimitResult = await withRateLimit(
      request,
      userContext.userId,
      userContext.subscriptionTier,
      'default'
    )
    
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!
    }

    const { sessionId } = await params

    // Validate sessionId format for security
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 10) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      )
    }

    // Get batch processing status using secure function (automatically validates ownership)
    const status = await getUserBatchSession(userContext.userId, sessionId)

    if (!status) {
      await logDataAccess(
        userContext.userId,
        'batch_session_not_found',
        'batch_session',
        sessionId,
        { action: 'GET', endpoint: '/api/batch/status' }
      )
      
      return NextResponse.json(
        { error: 'Batch session not found' },
        { status: 404 }
      )
    }

    // Log successful access
    await logDataAccess(
      userContext.userId,
      'read',
      'batch_session',
      sessionId,
      { 
        status: status.status,
        totalFiles: status.totalFiles,
        processedFiles: status.processedFiles,
        failedFiles: status.failedFiles,
        endpoint: '/api/batch/status',
        method: 'GET'
      }
    )

    return NextResponse.json({
      success: true,
      status
    })

  } catch (error) {
    console.error('Error getting batch status:', error)
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    if (error instanceof Error && error.message === 'User account not found or inactive') {
      return NextResponse.json(
        { success: false, error: 'User account not found or inactive' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}