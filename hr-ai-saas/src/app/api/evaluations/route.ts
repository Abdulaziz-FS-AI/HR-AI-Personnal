import { NextRequest, NextResponse } from "next/server"
import { requireUserContext, validateResourceOwnership, logDataAccess, checkUserQuota } from "@/lib/security/user-context"
import { withRateLimit } from "@/lib/security/rate-limit"
import { getUserEvaluations, createUserEvaluation } from "@/lib/db-secure"
import { z } from "zod"

const createEvaluationSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  roleId: z.string().uuid("Invalid role ID"),
  roleTitle: z.string(),
  files: z.array(z.object({
    id: z.string(),
    name: z.string(),
    size: z.number()
  })).min(1, "At least one file is required")
})

// GET /api/evaluations - List all evaluations for authenticated user
export async function GET(request: NextRequest) {
  try {
    // Secure user context validation
    const userContext = await requireUserContext(request)
    
    // Apply rate limiting
    const rateLimitCheck = await withRateLimit(
      request,
      userContext.userId,
      userContext.subscriptionTier,
      'default'
    )
    if (!rateLimitCheck.allowed) return rateLimitCheck.response

    const { searchParams } = new URL(request.url)
    const roleId = searchParams.get('roleId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get evaluations with built-in user isolation
    const evaluations = await getUserEvaluations(userContext.userId, {
      roleId: roleId || undefined,
      status: status as any,
      limit,
      offset
    })

    // Log data access for audit
    await logDataAccess(
      userContext.userId,
      'LIST_EVALUATIONS',
      'evaluations',
      'multiple',
      { 
        count: evaluations.length,
        roleId,
        status,
        limit,
        offset
      }
    )

    return NextResponse.json({
      success: true,
      data: evaluations,
      pagination: {
        limit,
        offset,
        hasMore: evaluations.length === limit
      }
    })

  } catch (error) {
    console.error('Evaluations fetch error:', error)
    
    // Check if it's an authentication error
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to fetch evaluations",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// POST /api/evaluations - Create new evaluation
export async function POST(request: NextRequest) {
  try {
    // Secure user context validation
    const userContext = await requireUserContext(request)
    
    // Apply rate limiting for creation endpoint
    const rateLimitCheck = await withRateLimit(
      request,
      userContext.userId,
      userContext.subscriptionTier,
      'create'
    )
    if (!rateLimitCheck.allowed) return rateLimitCheck.response

    const body = await request.json()
    
    // Validate input
    const validationResult = createEvaluationSchema.safeParse(body)
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

    const { name, roleId, roleTitle, files } = validationResult.data

    // Validate role ownership
    const hasAccess = await validateResourceOwnership(roleId, userContext.userId, 'role')
    if (!hasAccess) {
      await logDataAccess(
        userContext.userId,
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        'role',
        roleId,
        { action: 'CREATE_EVALUATION' }
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

    // Create evaluation with user context
    const evaluation = await createUserEvaluation(userContext.userId, {
      name,
      roleId,
      roleTitle,
      files,
      status: 'created'
    })

    // Log evaluation creation
    await logDataAccess(
      userContext.userId,
      'CREATE_EVALUATION',
      'evaluation',
      evaluation.id,
      { 
        name,
        roleId,
        fileCount: files.length
      }
    )

    return NextResponse.json({
      success: true,
      data: evaluation,
      message: "Evaluation created successfully",
      quota: {
        evaluations: {
          used: evaluationQuota.current + 1,
          limit: evaluationQuota.limit
        }
      }
    })

  } catch (error) {
    console.error('Evaluation creation error:', error)
    
    // Check if it's an authentication error
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to create evaluation",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}