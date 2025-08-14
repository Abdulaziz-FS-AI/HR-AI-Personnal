import { NextRequest, NextResponse } from 'next/server'
import { BatchProcessor } from '@/lib/batch-processor'
import { requireUserContext, checkUserQuota, validateResourceOwnership, logDataAccess } from '@/lib/security/user-context'
import { withRateLimit } from '@/lib/security/rate-limit'
import { z } from 'zod'

const batchStartSchema = z.object({
  roleId: z.string().uuid("Invalid role ID")
})

export async function POST(request: NextRequest) {
  try {
    // Secure user context validation
    const userContext = await requireUserContext(request)
    
    // Apply rate limiting for evaluation endpoint
    const rateLimitCheck = await withRateLimit(
      request,
      userContext.userId,
      userContext.subscriptionTier,
      'evaluate'
    )
    if (!rateLimitCheck.allowed) return rateLimitCheck.response

    const body = await request.json()
    
    // Validate input
    const validationResult = batchStartSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false,
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }
    
    const { roleId } = validationResult.data

    // Verify role ownership
    const hasAccess = await validateResourceOwnership(roleId, userContext.userId, 'role')
    if (!hasAccess) {
      await logDataAccess(
        userContext.userId,
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        'role',
        roleId,
        { action: 'START_BATCH_PROCESSING' }
      )
      
      return NextResponse.json(
        { success: false, message: 'Role not found or access denied' },
        { status: 404 }
      )
    }

    // Check evaluation quota
    const evaluationQuota = await checkUserQuota(userContext.userId, 'evaluations')
    if (!evaluationQuota.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Evaluation limit reached (${evaluationQuota.current}/${evaluationQuota.limit} this month). Please upgrade your plan.`,
          quota: evaluationQuota
        },
        { status: 429 }
      )
    }

    // Check if user has credits remaining
    if (userContext.creditsRemaining <= 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'No credits remaining. Please purchase more credits or upgrade your plan.',
          creditsRemaining: 0
        },
        { status: 402 } // Payment Required
      )
    }

    // Start batch processing with user context
    const sessionId = await BatchProcessor.startBatchProcessing(
      roleId, 
      userContext.userId
    )

    // Log batch processing start
    await logDataAccess(
      userContext.userId,
      'START_BATCH_PROCESSING',
      'batch_session',
      sessionId,
      { roleId }
    )

    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Batch processing started successfully',
      quota: {
        evaluations: {
          used: evaluationQuota.current + 1,
          limit: evaluationQuota.limit
        },
        creditsRemaining: userContext.creditsRemaining
      }
    })

  } catch (error) {
    console.error('Error starting batch processing:', error)
    
    // Check if it's an authentication error
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 401 }
      )
    }
    
    // Check if it's a no files error
    if (error instanceof Error && error.message.includes('No files ready')) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'No files ready for processing. Please upload files first.'
        },
        { status: 400 }
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