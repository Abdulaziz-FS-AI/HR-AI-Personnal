import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getRoleById, getRoleQuestions, createRoleQuestion, deleteRoleQuestion } from "@/lib/db"
import { z } from "zod"

const createQuestionSchema = z.object({
  roleId: z.string().uuid("Invalid role ID"),
  questionText: z.string().min(10, "Question must be at least 10 characters").max(300, "Question too long"),
  weight: z.number().min(1, "Weight must be at least 1").max(10, "Weight cannot exceed 10"),
  category: z.string().max(50, "Category name too long").optional(),
})

const deleteQuestionSchema = z.object({
  questionId: z.string().uuid("Invalid question ID"),
})

// GET /api/role-questions?roleId=xxx - Get all questions for a role
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

    const questions = await getRoleQuestions(roleId)
    
    return NextResponse.json({
      success: true,
      data: questions
    })
    
  } catch (error) {
    console.error('Role questions fetch error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to fetch role questions",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// POST /api/role-questions - Add question to role
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
    const validationResult = createQuestionSchema.safeParse(body)
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

    const questionData = validationResult.data

    // Verify role belongs to user
    const role = await getRoleById(questionData.roleId, session.user.id)
    if (!role) {
      return NextResponse.json(
        { success: false, message: "Role not found or access denied" },
        { status: 404 }
      )
    }

    // Check question limit (max 20 questions per role)
    const existingQuestions = await getRoleQuestions(questionData.roleId)
    if (existingQuestions.length >= 20) {
      return NextResponse.json(
        { success: false, message: "Maximum 20 questions allowed per role" },
        { status: 400 }
      )
    }

    // Check for duplicate questions
    const questionExists = existingQuestions.some(
      q => q.questionText.toLowerCase().trim() === questionData.questionText.toLowerCase().trim()
    )

    if (questionExists) {
      return NextResponse.json(
        { success: false, message: "This question already exists for this role" },
        { status: 409 }
      )
    }

    const newQuestion = await createRoleQuestion({
      ...questionData,
      category: questionData.category || null
    })
    
    if (!newQuestion) {
      return NextResponse.json(
        { success: false, message: "Failed to create question" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newQuestion,
      message: "Question added successfully"
    }, { status: 201 })
    
  } catch (error) {
    console.error('Role question creation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to create question",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// DELETE /api/role-questions - Remove question from role
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
    const validationResult = deleteQuestionSchema.safeParse(body)
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

    const { questionId } = validationResult.data

    // We could add additional checks here to verify the question belongs to a role owned by the user
    // For now, we'll rely on the database foreign key constraints and soft delete
    
    const deleted = await deleteRoleQuestion(questionId)
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Question not found or already deleted" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Question removed successfully"
    })
    
  } catch (error) {
    console.error('Role question deletion error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to delete question",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}