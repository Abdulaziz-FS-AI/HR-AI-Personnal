import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getRoleById, updateRole, deleteRole } from "@/lib/db"
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
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
    }

    const { id: roleId } = await params
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(roleId)) {
      return NextResponse.json(
        { success: false, message: "Invalid role ID format" },
        { status: 400 }
      )
    }

    const role = await getRoleById(roleId, session.user.id)
    
    if (!role) {
      return NextResponse.json(
        { success: false, message: "Role not found" },
        { status: 404 }
      )
    }

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
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
    }

    const { id: roleId } = await params
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(roleId)) {
      return NextResponse.json(
        { success: false, message: "Invalid role ID format" },
        { status: 400 }
      )
    }

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

    // Check if role exists and belongs to user
    const existingRole = await getRoleById(roleId, session.user.id)
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

    const updatedRole = await updateRole(roleId, session.user.id, updates)
    
    if (!updatedRole) {
      return NextResponse.json(
        { success: false, message: "Failed to update role" },
        { status: 500 }
      )
    }

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
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
    }

    const { id: roleId } = await params
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(roleId)) {
      return NextResponse.json(
        { success: false, message: "Invalid role ID format" },
        { status: 400 }
      )
    }

    // Check if role exists and belongs to user
    const existingRole = await getRoleById(roleId, session.user.id)
    if (!existingRole) {
      return NextResponse.json(
        { success: false, message: "Role not found" },
        { status: 404 }
      )
    }

    const deleted = await deleteRole(roleId, session.user.id)
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Failed to delete role" },
        { status: 500 }
      )
    }

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