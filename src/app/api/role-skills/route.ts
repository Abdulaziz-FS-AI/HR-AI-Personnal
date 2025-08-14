import { NextRequest, NextResponse } from "next/server"
import { requireUserContext, logDataAccess, validateResourceOwnership } from "@/lib/security/user-context"
import { withRateLimit } from "@/lib/security/rate-limit"
import { getUserRole, getUserRoleSkills, createUserRoleSkill, deleteUserRoleSkill } from "@/lib/db-secure"
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

    // Validate resource ownership
    const hasAccess = await validateResourceOwnership(roleId, userContext.userId, 'role')
    if (!hasAccess) {
      await logDataAccess(
        userContext.userId,
        'unauthorized_access_attempt',
        'role_skills',
        roleId,
        { action: 'GET', endpoint: '/api/role-skills' }
      )
      
      return NextResponse.json(
        { success: false, message: "Role not found or access denied" },
        { status: 404 }
      )
    }

    // Get skills using secure function
    const skills = await getUserRoleSkills(userContext.userId, roleId)
    
    // Log successful data access
    await logDataAccess(
      userContext.userId,
      'read',
      'role_skills',
      roleId,
      { 
        skillCount: skills.length,
        endpoint: '/api/role-skills',
        method: 'GET'
      }
    )
    
    return NextResponse.json({
      success: true,
      data: skills
    })
    
  } catch (error) {
    console.error('Role skills fetch error:', error)
    
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
    // Authenticate user and get secure context
    const userContext = await requireUserContext(request)
    
    // Apply rate limiting for create operations
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

    // Validate resource ownership
    const hasAccess = await validateResourceOwnership(skillData.roleId, userContext.userId, 'role')
    if (!hasAccess) {
      await logDataAccess(
        userContext.userId,
        'unauthorized_access_attempt',
        'role_skills',
        skillData.roleId,
        { action: 'POST', endpoint: '/api/role-skills', skillName: skillData.skillName }
      )
      
      return NextResponse.json(
        { success: false, message: "Role not found or access denied" },
        { status: 404 }
      )
    }

    // Check if skill already exists for this role
    const existingSkills = await getUserRoleSkills(userContext.userId, skillData.roleId)
    const skillExists = existingSkills.some(
      skill => skill.skillName.toLowerCase() === skillData.skillName.toLowerCase()
    )

    if (skillExists) {
      await logDataAccess(
        userContext.userId,
        'duplicate_skill_attempt',
        'role_skills',
        skillData.roleId,
        { skillName: skillData.skillName, endpoint: '/api/role-skills' }
      )
      
      return NextResponse.json(
        { success: false, message: "Skill already exists for this role" },
        { status: 409 }
      )
    }

    // Create the skill using secure function
    const newSkill = await createUserRoleSkill(userContext.userId, {
      ...skillData,
      skillCategory: skillData.skillCategory || null
    })
    
    if (!newSkill) {
      return NextResponse.json(
        { success: false, message: "Failed to create skill" },
        { status: 500 }
      )
    }

    // Log successful creation
    await logDataAccess(
      userContext.userId,
      'create',
      'role_skills',
      newSkill.id,
      { 
        skillName: newSkill.skillName,
        skillCategory: newSkill.skillCategory,
        weight: newSkill.weight,
        roleId: newSkill.roleId,
        endpoint: '/api/role-skills',
        method: 'POST'
      }
    )

    return NextResponse.json({
      success: true,
      data: newSkill,
      message: "Skill added successfully"
    }, { status: 201 })
    
  } catch (error) {
    console.error('Role skill creation error:', error)
    
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

    // Delete using secure function (includes ownership validation)
    const deleted = await deleteUserRoleSkill(userContext.userId, skillId)
    
    if (!deleted) {
      await logDataAccess(
        userContext.userId,
        'unauthorized_delete_attempt',
        'role_skills',
        skillId,
        { action: 'DELETE', endpoint: '/api/role-skills' }
      )
      
      return NextResponse.json(
        { success: false, message: "Skill not found or already deleted" },
        { status: 404 }
      )
    }

    // Log successful deletion
    await logDataAccess(
      userContext.userId,
      'delete',
      'role_skills',
      skillId,
      { 
        endpoint: '/api/role-skills',
        method: 'DELETE'
      }
    )

    return NextResponse.json({
      success: true,
      message: "Skill removed successfully"
    })
    
  } catch (error) {
    console.error('Role skill deletion error:', error)
    
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
        message: "Failed to delete skill",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}