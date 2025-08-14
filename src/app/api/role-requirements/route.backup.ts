import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createRoleRequirement, getRoleRequirements } from "@/lib/db-role-requirements"
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
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const roleId = url.searchParams.get('roleId')
    
    if (!roleId) {
      return NextResponse.json(
        { success: false, message: "Role ID is required" },
        { status: 400 }
      )
    }

    const requirements = await getRoleRequirements(roleId)
    
    return NextResponse.json({
      success: true,
      data: requirements
    })
    
  } catch (error) {
    console.error('Requirements fetch error:', error)
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
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
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

    const newRequirement = await createRoleRequirement(requirementData)
    
    if (!newRequirement) {
      return NextResponse.json(
        { success: false, message: "Failed to create requirement" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newRequirement,
      message: "Requirement created successfully"
    }, { status: 201 })
    
  } catch (error) {
    console.error('Requirement creation error:', error)
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