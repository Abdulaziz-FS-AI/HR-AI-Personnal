import { NextRequest, NextResponse } from 'next/server'
import { requireUserContext, validateResourceOwnership, logDataAccess } from '@/lib/security/user-context'
import { withRateLimit } from '@/lib/security/rate-limit'
import { getUserResults } from '@/lib/db-secure'

interface RouteParams {
  params: Promise<{ roleId: string }>
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
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

    const { roleId } = await params
    const { searchParams } = new URL(request.url)
    
    // Validate role ownership
    const hasAccess = await validateResourceOwnership(roleId, userContext.userId, 'role')
    if (!hasAccess) {
      await logDataAccess(
        userContext.userId,
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        'role',
        roleId,
        { action: 'GET_RESULTS' }
      )
      
      return NextResponse.json(
        { success: false, message: 'Role not found or access denied' },
        { status: 404 }
      )
    }
    
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const minScore = searchParams.get('minScore') ? parseFloat(searchParams.get('minScore')!) : undefined

    // Get analysis results with built-in user isolation
    const results = await getUserResults(userContext.userId, {
      roleId,
      limit,
      offset,
      minScore
    })

    // Log data access for audit
    await logDataAccess(
      userContext.userId,
      'GET_RESULTS',
      'results',
      'multiple',
      { 
        roleId,
        count: results.length,
        limit,
        offset,
        minScore
      }
    )

    return NextResponse.json({
      success: true,
      results,
      pagination: {
        limit,
        offset,
        hasMore: results.length === limit
      }
    })

  } catch (error) {
    console.error('Results fetch error:', error)
    
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
        message: 'Failed to fetch results',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}