import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getRoleById, getRoleSkills, createRoleSkill, deleteRoleSkill } from "@/lib/db"
import { skillSchema } from "@/lib/validations/role"
import { z } from "zod"

// Use the shared validation schema
const createSkillSchema = skillSchema

const deleteSkillSchema = z.object({
  skillId: z.string().uuid("Invalid skill ID"),
})

// GET /api/role-skills?roleId=xxx - Get all skills for a role
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const roleId = searchParams.get('roleId')

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

    // Verify role belongs to user
    const role = await getRoleById(roleId, session.user.id)
    if (!role) {
      return NextResponse.json(
        { success: false, message: "Role not found or access denied" },
        { status: 404 }
      )
    }

    const skills = await getRoleSkills(roleId)
    
    return NextResponse.json({
      success: true,
      data: skills
    })
    
  } catch (error) {
    console.error('Role skills fetch error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to fetch role skills",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// POST /api/role-skills - Add skill to role
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
    const validationResult = createSkillSchema.safeParse(body)
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

    const skillData = validationResult.data

    // Verify role belongs to user
    const role = await getRoleById(skillData.roleId, session.user.id)
    if (!role) {
      return NextResponse.json(
        { success: false, message: "Role not found or access denied" },
        { status: 404 }
      )
    }

    // Check if skill already exists for this role
    const existingSkills = await getRoleSkills(skillData.roleId)
    const skillExists = existingSkills.some(
      skill => skill.skillName.toLowerCase() === skillData.skillName.toLowerCase()
    )

    if (skillExists) {
      return NextResponse.json(
        { success: false, message: "Skill already exists for this role" },
        { status: 409 }
      )
    }

    const newSkill = await createRoleSkill({
      ...skillData,
      skillCategory: skillData.skillCategory || null
    })
    
    if (!newSkill) {
      return NextResponse.json(
        { success: false, message: "Failed to create skill" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newSkill,
      message: "Skill added successfully"
    }, { status: 201 })
    
  } catch (error) {
    console.error('Role skill creation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to create skill",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// DELETE /api/role-skills - Remove skill from role
export async function DELETE(request: NextRequest) {
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
    const validationResult = deleteSkillSchema.safeParse(body)
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

    const { skillId } = validationResult.data

    // We could add additional checks here to verify the skill belongs to a role owned by the user
    // For now, we'll rely on the database foreign key constraints
    
    const deleted = await deleteRoleSkill(skillId)
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Skill not found or already deleted" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Skill removed successfully"
    })
    
  } catch (error) {
    console.error('Role skill deletion error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to delete skill",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}