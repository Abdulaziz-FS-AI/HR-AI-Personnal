import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { z } from "zod"
import sql from 'mssql'
import { getDbConnection } from '@/lib/db'

const createEvaluationSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  roleId: z.string().uuid("Invalid role ID"),
  roleTitle: z.string(),
  files: z.array(z.object({
    id: z.string(),
    name: z.string(),
    size: z.number()
  })).min(1, "At least one file is required")
})

// GET /api/evaluations - List all evaluations for authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
    }

    const pool = await getDbConnection()
    const result = await pool.request()
      .input('userId', sql.NVarChar, session.user.id)
      .query(`
        SELECT 
          es.id,
          es.name,
          es.role_id as roleId,
          r.title as roleTitle,
          es.status,
          es.total_files as totalResumes,
          es.processed_files as processedResumes,
          es.average_score as averageScore,
          es.top_candidates as topCandidates,
          es.created_at as createdAt,
          es.completed_at as completedAt
        FROM evaluation_sessions es
        INNER JOIN roles r ON es.role_id = r.id
        WHERE es.user_id = @userId
        ORDER BY es.created_at DESC
      `)
    
    await pool.close()
    
    return NextResponse.json({
      success: true,
      data: result.recordset
    })
    
  } catch (error) {
    console.error('Evaluations fetch error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to fetch evaluations",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// POST /api/evaluations - Create new evaluation session
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
    const validationResult = createEvaluationSchema.safeParse(body)
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

    const { name, roleId, files } = validationResult.data

    const pool = await getDbConnection()
    
    // Create evaluation session
    const sessionResult = await pool.request()
      .input('userId', sql.NVarChar, session.user.id)
      .input('roleId', sql.UniqueIdentifier, roleId)
      .input('name', sql.NVarChar, name)
      .input('totalFiles', sql.Int, files.length)
      .input('status', sql.NVarChar, 'pending')
      .query(`
        INSERT INTO evaluation_sessions (
          user_id, role_id, name, total_files, processed_files, status
        )
        OUTPUT INSERTED.id, INSERTED.name, INSERTED.role_id as roleId,
               INSERTED.status, INSERTED.total_files as totalFiles,
               INSERTED.created_at as createdAt
        VALUES (
          @userId, @roleId, @name, @totalFiles, 0, @status
        )
      `)
    
    const evaluationSession = sessionResult.recordset[0]
    
    // Insert files for this evaluation session
    for (const file of files) {
      await pool.request()
        .input('sessionId', sql.UniqueIdentifier, evaluationSession.id)
        .input('fileName', sql.NVarChar, file.name)
        .input('fileSize', sql.Int, file.size)
        .input('status', sql.NVarChar, 'pending')
        .query(`
          INSERT INTO evaluation_files (
            session_id, file_name, file_size, status
          )
          VALUES (
            @sessionId, @fileName, @fileSize, @status
          )
        `)
    }
    
    await pool.close()

    return NextResponse.json({
      success: true,
      data: evaluationSession,
      message: "Evaluation session created successfully"
    }, { status: 201 })
    
  } catch (error) {
    console.error('Evaluation creation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to create evaluation",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}