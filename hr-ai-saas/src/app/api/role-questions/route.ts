import { NextRequest, NextResponse } from "next/server"
import { requireUserContext, logDataAccess, validateResourceOwnership } from "@/lib/security/user-context"
import { withRateLimit } from "@/lib/security/rate-limit"
import { getUserRole, getUserRoleQuestions, createUserRoleQuestion, deleteUserRoleQuestion } from "@/lib/db-secure"
import { questionSchema } from "@/lib/validations/role"
import { z } from "zod"

// Use the shared validation schema
const createQuestionSchema = questionSchema

const deleteQuestionSchema = z.object({
  questionId: z.string().uuid("Invalid question ID"),
})

// GET /api/role-questions?roleId=xxx - Get all questions for a role
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
        'role_questions',
        roleId,
        { action: 'GET', endpoint: '/api/role-questions' }
      )
      
      return NextResponse.json(
        { success: false, message: "Role not found or access denied" },
        { status: 404 }
      )
    }

    // Get questions using secure function
    const questions = await getUserRoleQuestions(userContext.userId, roleId)
    
    // Log successful data access
    await logDataAccess(
      userContext.userId,
      'read',
      'role_questions',
      roleId,
      { 
        questionCount: questions.length,
        endpoint: '/api/role-questions',
        method: 'GET'
      }
    )
    
    return NextResponse.json({
      success: true,
      data: questions
    })
    
  } catch (error) {
    console.error('Role questions fetch error:', error)
    
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

    // Validate resource ownership
    const hasAccess = await validateResourceOwnership(questionData.roleId, userContext.userId, 'role')
    if (!hasAccess) {
      await logDataAccess(
        userContext.userId,
        'unauthorized_access_attempt',
        'role_questions',
        questionData.roleId,
        { action: 'POST', endpoint: '/api/role-questions', questionText: questionData.questionText }
      )
      
      return NextResponse.json(
        { success: false, message: "Role not found or access denied" },
        { status: 404 }
      )
    }

    // Check question limit (max 5 questions per role)
    const existingQuestions = await getUserRoleQuestions(userContext.userId, questionData.roleId)
    if (existingQuestions.length >= 5) {
      await logDataAccess(
        userContext.userId,
        'question_limit_exceeded',
        'role_questions',
        questionData.roleId,
        { questionCount: existingQuestions.length, endpoint: '/api/role-questions' }
      )
      
      return NextResponse.json(
        { success: false, message: "Maximum 5 questions allowed per role" },
        { status: 400 }
      )
    }

    // Check for duplicate questions
    const questionExists = existingQuestions.some(
      q => q.questionText.toLowerCase().trim() === questionData.questionText.toLowerCase().trim()
    )

    if (questionExists) {
      await logDataAccess(
        userContext.userId,
        'duplicate_question_attempt',
        'role_questions',
        questionData.roleId,
        { questionText: questionData.questionText, endpoint: '/api/role-questions' }
      )
      
      return NextResponse.json(
        { success: false, message: "This question already exists for this role" },
        { status: 409 }
      )
    }

    // Create the question using secure function
    const newQuestion = await createUserRoleQuestion(userContext.userId, {
      ...questionData,
      category: questionData.category || null
    })
    
    if (!newQuestion) {
      return NextResponse.json(
        { success: false, message: "Failed to create question" },
        { status: 500 }
      )
    }

    // Log successful creation
    await logDataAccess(
      userContext.userId,
      'create',
      'role_questions',
      newQuestion.id,
      { 
        questionText: newQuestion.questionText,
        category: newQuestion.category,
        weight: newQuestion.weight,
        roleId: newQuestion.roleId,
        endpoint: '/api/role-questions',
        method: 'POST'
      }
    )

    return NextResponse.json({
      success: true,
      data: newQuestion,
      message: "Question added successfully"
    }, { status: 201 })
    
  } catch (error) {
    console.error('Role question creation error:', error)
    
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

    // Delete using secure function (includes ownership validation)
    const deleted = await deleteUserRoleQuestion(userContext.userId, questionId)
    
    if (!deleted) {
      await logDataAccess(
        userContext.userId,
        'unauthorized_delete_attempt',
        'role_questions',
        questionId,
        { action: 'DELETE', endpoint: '/api/role-questions' }
      )
      
      return NextResponse.json(
        { success: false, message: "Question not found or already deleted" },
        { status: 404 }
      )
    }

    // Log successful deletion
    await logDataAccess(
      userContext.userId,
      'delete',
      'role_questions',
      questionId,
      { 
        endpoint: '/api/role-questions',
        method: 'DELETE'
      }
    )

    return NextResponse.json({
      success: true,
      message: "Question removed successfully"
    })
    
  } catch (error) {
    console.error('Role question deletion error:', error)
    
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
        message: "Failed to delete question",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}