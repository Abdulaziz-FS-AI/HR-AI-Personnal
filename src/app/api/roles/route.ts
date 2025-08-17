import { NextRequest, NextResponse } from "next/server"
import { requireUserContext, logDataAccess } from "@/lib/security/user-context"
import { getUserRoles, createUserRole } from "@/lib/db-secure"
import { createRoleSchema as validationSchema } from "@/lib/validations/role"

// Use the shared validation schema
const createRoleSchema = validationSchema

// GET /api/roles - List all roles for authenticated user
export async function GET(request: NextRequest) {
  try {
    // Secure user context validation
    const userContext = await requireUserContext(request)
    
    // Get roles with built-in user isolation
    const roles = await getUserRoles(userContext.userId)
    
    // Log data access for audit
    await logDataAccess(
      userContext.userId,
      'LIST_ROLES',
      'roles',
      'multiple',
      { count: roles.length }
    )
    
    return NextResponse.json({
      success: true,
      data: roles
    })
    
  } catch (error) {
    console.error('Roles fetch error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to fetch roles",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// POST /api/roles - Create new role
export async function POST(request: NextRequest) {
  try {
    // Secure user context validation
    const userContext = await requireUserContext(request)
    
    const body = await request.json()
    
    // Validate input data
    const validationResult = createRoleSchema.safeParse(body)
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

    const roleData = validationResult.data

    // Extract requirements text from structured format
    const educationRequirements = roleData.educationRequirements?.hasRequirements 
      ? roleData.educationRequirements.requirements 
      : "No specific education requirements"

    const experienceRequirements = roleData.experienceRequirements?.hasRequirements 
      ? roleData.experienceRequirements.requirements 
      : "No specific experience requirements"

    // Create role with secure user-scoped function
    const newRole = await createUserRole(userContext.userId, {
      title: roleData.title,
      description: roleData.description,
      responsibilities: roleData.responsibilities || null,
      educationRequirements: educationRequirements,
      experienceRequirements: experienceRequirements,
      bonusConfig: roleData.bonusConfig || null,
      penaltyConfig: roleData.penaltyConfig || null
    })
    
    if (!newRole) {
      return NextResponse.json(
        { success: false, message: "Failed to create role" },
        { status: 500 }
      )
    }
    
    // Log role creation
    await logDataAccess(
      userContext.userId,
      'CREATE_ROLE',
      'role',
      newRole.id,
      { title: newRole.title }
    )

    return NextResponse.json({
      success: true,
      data: newRole,
      message: "Role created successfully"
    }, { status: 201 })
    
  } catch (error) {
    console.error('Role creation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to create role",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}