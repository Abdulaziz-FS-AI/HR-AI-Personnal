import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getRolesByUserId, createRole } from "@/lib/db"
import { createRoleSchema as validationSchema } from "@/lib/validations/role"

// Use the shared validation schema
const createRoleSchema = validationSchema

// GET /api/roles - List all roles for authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
    }

    const roles = await getRolesByUserId(session.user.id)
    
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
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
    }

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

    const roleData = {
      ...validationResult.data,
      userId: session.user.id
    }

    // Validate experience years relationship
    if (roleData.minExperienceYears && roleData.maxExperienceYears) {
      if (roleData.minExperienceYears > roleData.maxExperienceYears) {
        return NextResponse.json(
          { 
            success: false, 
            message: "Minimum experience cannot be greater than maximum experience"
          },
          { status: 400 }
        )
      }
    }

    const newRole = await createRole({
      ...roleData,
      description: roleData.description || null,
      responsibilities: roleData.responsibilities || null,
      department: roleData.department || null,
      location: roleData.location || null,
      employmentType: roleData.employmentType || null,
      seniorityLevel: roleData.seniorityLevel || null,
      minExperienceYears: roleData.minExperienceYears || null,
      maxExperienceYears: roleData.maxExperienceYears || null,
      educationRequirements: roleData.educationRequirements || null
    })
    
    if (!newRole) {
      return NextResponse.json(
        { success: false, message: "Failed to create role" },
        { status: 500 }
      )
    }

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