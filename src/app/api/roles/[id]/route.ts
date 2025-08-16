import { NextRequest, NextResponse } from "next/server"
import { requireUserContext, validateResourceOwnership, logDataAccess } from "@/lib/security/user-context"
import { getUserRole, deleteUserRole } from "@/lib/db-secure"
import { withRateLimit } from "@/lib/security/rate-limit"


interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/roles/[id] - Get specific role
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Secure user context validation
    const userContext = await requireUserContext(request)
    
    const { id: roleId } = await params
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(roleId)) {
      return NextResponse.json(
        { success: false, message: "Invalid role ID format" },
        { status: 400 }
      )
    }

    // Apply rate limiting
    const rateLimitCheck = await withRateLimit(
      request,
      userContext.userId,
      userContext.subscriptionTier,
      'default'
    )
    if (!rateLimitCheck.allowed) return rateLimitCheck.response

    // Validate ownership
    const hasAccess = await validateResourceOwnership(roleId, userContext.userId, 'role')
    if (!hasAccess) {
      // Log unauthorized access attempt
      await logDataAccess(
        userContext.userId,
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        'role',
        roleId,
        { action: 'GET' }
      )
      
      return NextResponse.json(
        { success: false, message: "Role not found or access denied" },
        { status: 404 }
      )
    }

    // Get role with secure function
    const role = await getUserRole(userContext.userId, roleId)
    
    if (!role) {
      return NextResponse.json(
        { success: false, message: "Role not found" },
        { status: 404 }
      )
    }

    // Log successful access
    await logDataAccess(
      userContext.userId,
      'VIEW_ROLE',
      'role',
      roleId
    )

    return NextResponse.json({
      success: true,
      data: role
    })
    
  } catch (error) {
    console.error('Role fetch error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to fetch role",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// PUT /api/roles/[id] - Update role (DISABLED - Users cannot edit roles)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return NextResponse.json(
    { 
      success: false, 
      message: "Role editing is not allowed. Please create a new role instead."
    },
    { status: 403 }
  )
}

// DELETE /api/roles/[id] - Delete specific role (permanent delete with cascade)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Secure user context validation
    const userContext = await requireUserContext(request)
    
    const { id: roleId } = await params
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(roleId)) {
      return NextResponse.json(
        { success: false, message: "Invalid role ID format" },
        { status: 400 }
      )
    }

    // Apply rate limiting
    const rateLimitCheck = await withRateLimit(
      request,
      userContext.userId,
      userContext.subscriptionTier,
      'default'
    )
    if (!rateLimitCheck.allowed) return rateLimitCheck.response

    // Validate ownership
    const hasAccess = await validateResourceOwnership(roleId, userContext.userId, 'role')
    if (!hasAccess) {
      // Log unauthorized access attempt
      await logDataAccess(
        userContext.userId,
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        'role',
        roleId,
        { action: 'DELETE' }
      )
      
      return NextResponse.json(
        { success: false, message: "Role not found or access denied" },
        { status: 404 }
      )
    }

    // Delete with secure function
    const deleted = await deleteUserRole(userContext.userId, roleId)
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Failed to delete role" },
        { status: 500 }
      )
    }

    // Log successful deletion
    await logDataAccess(
      userContext.userId,
      'DELETE_ROLE',
      'role',
      roleId
    )

    return NextResponse.json({
      success: true,
      message: "Role deleted successfully"
    })
    
  } catch (error) {
    console.error('Role deletion error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to delete role",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}