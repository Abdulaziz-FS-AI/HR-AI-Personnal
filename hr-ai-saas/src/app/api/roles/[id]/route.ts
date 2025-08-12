import { NextRequest, NextResponse } from "next/server"
import { requireUserContext, validateResourceOwnership, logDataAccess } from "@/lib/security/user-context"
import { getUserRole, updateUserRole, deleteUserRole } from "@/lib/db-secure"
import { withRateLimit } from "@/lib/security/rate-limit"
import { z } from "zod"

const updateRoleSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").max(255, "Title too long").optional(),
  description: z.string().max(5000, "Description too long").optional(),
  responsibilities: z.string().max(5000, "Responsibilities too long").optional(),
  department: z.string().max(100, "Department name too long").optional(),
  location: z.string().max(100, "Location name too long").optional(),
  employmentType: z.enum(["full-time", "part-time", "contract", "freelance", "internship"]).optional(),
  seniorityLevel: z.enum(["entry", "junior", "mid", "senior", "lead", "executive"]).optional(),
  minExperienceYears: z.number().min(0, "Experience cannot be negative").max(50, "Experience too high").optional(),
  maxExperienceYears: z.number().min(0, "Experience cannot be negative").max(50, "Experience too high").optional(),
  educationRequirements: z.string().max(1000, "Education requirements too long").optional(),
})

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

// PUT /api/roles/[id] - Update specific role
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json()
    
    // Validate input data
    const validationResult = updateRoleSchema.safeParse(body)
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

    const updates = validationResult.data

    // Validate experience years relationship if both are provided
    if (updates.minExperienceYears !== undefined && updates.maxExperienceYears !== undefined) {
      if (updates.minExperienceYears > updates.maxExperienceYears) {
        return NextResponse.json(
          { 
            success: false, 
            message: "Minimum experience cannot be greater than maximum experience"
          },
          { status: 400 }
        )
      }
    }

    // Validate ownership
    const hasAccess = await validateResourceOwnership(roleId, userContext.userId, 'role')
    if (!hasAccess) {
      // Log unauthorized access attempt
      await logDataAccess(
        userContext.userId,
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        'role',
        roleId,
        { action: 'UPDATE' }
      )
      
      return NextResponse.json(
        { success: false, message: "Role not found or access denied" },
        { status: 404 }
      )
    }

    // Check existing role for experience validation
    const existingRole = await getUserRole(userContext.userId, roleId)
    if (!existingRole) {
      return NextResponse.json(
        { success: false, message: "Role not found" },
        { status: 404 }
      )
    }

    // Additional validation for experience years when only one is being updated
    const finalMinExp = updates.minExperienceYears ?? existingRole.minExperienceYears
    const finalMaxExp = updates.maxExperienceYears ?? existingRole.maxExperienceYears
    
    if (finalMinExp && finalMaxExp && finalMinExp > finalMaxExp) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Minimum experience cannot be greater than maximum experience"
        },
        { status: 400 }
      )
    }

    // Update with secure function
    const updatedRole = await updateUserRole(userContext.userId, roleId, updates)
    
    if (!updatedRole) {
      return NextResponse.json(
        { success: false, message: "Failed to update role" },
        { status: 500 }
      )
    }

    // Log successful update
    await logDataAccess(
      userContext.userId,
      'UPDATE_ROLE',
      'role',
      roleId,
      { changes: Object.keys(updates) }
    )

    return NextResponse.json({
      success: true,
      data: updatedRole,
      message: "Role updated successfully"
    })
    
  } catch (error) {
    console.error('Role update error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to update role",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// DELETE /api/roles/[id] - Delete specific role (soft delete)
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