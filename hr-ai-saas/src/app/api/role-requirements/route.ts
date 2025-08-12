import { NextRequest, NextResponse } from "next/server"
import { requireUserContext, logDataAccess, validateResourceOwnership } from "@/lib/security/user-context"
import { withRateLimit } from "@/lib/security/rate-limit"
import { getUserRole, getUserRoleRequirements, createUserRoleRequirement } from "@/lib/db-secure"
import { z } from "zod"

const createRequirementSchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
  requirementText: z.string().min(1, "Requirement text is required"),
  weight: z.number().min(1).max(10),
  isRequired: z.boolean(),
  category: z.enum(["education", "experience", "other"])
})

// GET /api/role-requirements?roleId={roleId} - Get requirements for a specific role
export async function GET(request: NextRequest) {
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

    const url = new URL(request.url)
    const roleId = url.searchParams.get('roleId')
    
    if (!roleId) {
      return NextResponse.json(
        { success: false, message: "Role ID is required" },
        { status: 400 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(roleId)) {
      return NextResponse.json(
        { success: false, message: "Invalid role ID format" },
        { status: 400 }
      )
    }

    // Validate resource ownership
    const hasAccess = await validateResourceOwnership(roleId, userContext.userId, 'role')
    if (!hasAccess) {
      await logDataAccess(
        userContext.userId,
        'unauthorized_access_attempt',
        'role_requirements',
        roleId,
        { action: 'GET', endpoint: '/api/role-requirements' }
      )
      
      return NextResponse.json(
        { success: false, message: "Role not found or access denied" },
        { status: 404 }
      )
    }

    const requirements = await getUserRoleRequirements(userContext.userId, roleId)
    
    // Log successful data access
    await logDataAccess(
      userContext.userId,
      'read',
      'role_requirements',
      roleId,
      { 
        requirementCount: requirements.length,
        endpoint: '/api/role-requirements',
        method: 'GET'
      }
    )
    
    return NextResponse.json({
      success: true,
      data: requirements
    })
    
  } catch (error) {
    console.error('Requirements fetch error:', error)
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
    }
    
    if (error instanceof Error && error.message === 'User account not found or inactive') {
      return NextResponse.json(
        { success: false, message: "User account not found or inactive" },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to fetch requirements",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// POST /api/role-requirements - Create new requirement
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    
    // Validate input data
    const validationResult = createRequirementSchema.safeParse(body)
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

    const requirementData = validationResult.data

    // Validate resource ownership
    const hasAccess = await validateResourceOwnership(requirementData.roleId, userContext.userId, 'role')
    if (!hasAccess) {
      await logDataAccess(
        userContext.userId,
        'unauthorized_access_attempt',
        'role_requirements',
        requirementData.roleId,
        { action: 'POST', endpoint: '/api/role-requirements', requirementText: requirementData.requirementText }
      )
      
      return NextResponse.json(
        { success: false, message: "Role not found or access denied" },
        { status: 404 }
      )
    }

    // Create using secure function
    const newRequirement = await createUserRoleRequirement(userContext.userId, requirementData)
    
    if (!newRequirement) {
      return NextResponse.json(
        { success: false, message: "Failed to create requirement" },
        { status: 500 }
      )
    }

    // Log successful creation
    await logDataAccess(
      userContext.userId,
      'create',
      'role_requirements',
      newRequirement.id,
      { 
        requirementText: newRequirement.requirementText,
        category: newRequirement.category,
        weight: newRequirement.weight,
        isRequired: newRequirement.isRequired,
        roleId: newRequirement.roleId,
        endpoint: '/api/role-requirements',
        method: 'POST'
      }
    )

    return NextResponse.json({
      success: true,
      data: newRequirement,
      message: "Requirement created successfully"
    }, { status: 201 })
    
  } catch (error) {
    console.error('Requirement creation error:', error)
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
    }
    
    if (error instanceof Error && error.message === 'User account not found or inactive') {
      return NextResponse.json(
        { success: false, message: "User account not found or inactive" },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to create requirement",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}