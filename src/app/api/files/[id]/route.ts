import { NextRequest, NextResponse } from "next/server"
import { requireUserContext, validateResourceOwnership, logDataAccess } from "@/lib/security/user-context"
import { withRateLimit } from "@/lib/security/rate-limit"
import { getUserFile, updateUserFile } from "@/lib/db-secure"
import { getBlobStorageService } from "@/lib/azure/blob-storage"
import { z } from "zod"

const updateFileSchema = z.object({
  status: z.enum(['pending', 'uploading', 'completed', 'failed']).optional(),
  processingStatus: z.enum(['not_started', 'extracting', 'analyzing', 'completed', 'failed']).optional(),
  aiScore: z.number().min(0).max(100).optional(),
  extractedText: z.string().optional(),
  metadata: z.object({}).optional()
})

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/files/[id] - Get specific file details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Secure user context validation
    const userContext = await requireUserContext(request)
    
    // Apply rate limiting
    const rateLimitCheck = await withRateLimit(
      request,
      userContext.userId,
      userContext.subscriptionTier,
      'default'
    )
    if (!rateLimitCheck.allowed) return rateLimitCheck.response

    const { id: fileId } = await params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(fileId)) {
      return NextResponse.json(
        { success: false, message: "Invalid file ID format" },
        { status: 400 }
      )
    }

    // Get file with built-in user isolation and ownership validation
    const file = await getUserFile(fileId, userContext.userId)
    
    if (!file) {
      // Log unauthorized access attempt
      await logDataAccess(
        userContext.userId,
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        'file',
        fileId,
        { action: 'GET_FILE' }
      )
      
      return NextResponse.json(
        { success: false, message: "File not found or access denied" },
        { status: 404 }
      )
    }

    // Log file access for audit
    await logDataAccess(
      userContext.userId,
      'GET_FILE',
      'file',
      fileId,
      { filename: file.originalFilename, size: file.fileSize }
    )

    return NextResponse.json({
      success: true,
      data: file
    })

  } catch (error) {
    console.error('File fetch error:', error)
    
    // Check if it's an authentication error
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to fetch file",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// PUT /api/files/[id] - Update file status/metadata
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Secure user context validation
    const userContext = await requireUserContext(request)
    
    // Apply rate limiting
    const rateLimitCheck = await withRateLimit(
      request,
      userContext.userId,
      userContext.subscriptionTier,
      'default'
    )
    if (!rateLimitCheck.allowed) return rateLimitCheck.response

    const { id: fileId } = await params
    const body = await request.json()

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(fileId)) {
      return NextResponse.json(
        { success: false, message: "Invalid file ID format" },
        { status: 400 }
      )
    }

    // Validate request body
    const validationResult = updateFileSchema.safeParse(body)
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

    // Verify file ownership before update
    const existingFile = await getUserFile(fileId, userContext.userId)
    if (!existingFile) {
      await logDataAccess(
        userContext.userId,
        'UNAUTHORIZED_UPDATE_ATTEMPT',
        'file',
        fileId,
        { action: 'UPDATE_FILE', data: validationResult.data }
      )
      
      return NextResponse.json(
        { success: false, message: "File not found or access denied" },
        { status: 404 }
      )
    }

    // Update file with user validation
    const updatedFile = await updateUserFile(fileId, userContext.userId, validationResult.data)

    // Log file update for audit
    await logDataAccess(
      userContext.userId,
      'UPDATE_FILE',
      'file',
      fileId,
      { 
        filename: existingFile.originalFilename,
        changes: validationResult.data
      }
    )

    return NextResponse.json({
      success: true,
      data: updatedFile,
      message: "File updated successfully"
    })

  } catch (error) {
    console.error('File update error:', error)
    
    // Check if it's an authentication error
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to update file",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// DELETE /api/files/[id] - Delete file
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Secure user context validation
    const userContext = await requireUserContext(request)
    
    // Apply rate limiting
    const rateLimitCheck = await withRateLimit(
      request,
      userContext.userId,
      userContext.subscriptionTier,
      'default'
    )
    if (!rateLimitCheck.allowed) return rateLimitCheck.response

    const { id: fileId } = await params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(fileId)) {
      return NextResponse.json(
        { success: false, message: "Invalid file ID format" },
        { status: 400 }
      )
    }

    // Get file to verify ownership and get blob info
    const file = await getUserFile(fileId, userContext.userId)
    if (!file) {
      await logDataAccess(
        userContext.userId,
        'UNAUTHORIZED_DELETE_ATTEMPT',
        'file',
        fileId,
        { action: 'DELETE_FILE' }
      )
      
      return NextResponse.json(
        { success: false, message: "File not found or access denied" },
        { status: 404 }
      )
    }

    // Delete from blob storage
    const blobService = getBlobStorageService()
    try {
      await blobService.deleteBlob(file.blobFilename)
    } catch (blobError) {
      console.warn('Failed to delete blob:', blobError)
      // Continue with database deletion even if blob deletion fails
    }

    // Delete from database
    await updateUserFile(fileId, userContext.userId, { deletedAt: new Date() })

    // Log file deletion for audit
    await logDataAccess(
      userContext.userId,
      'DELETE_FILE',
      'file',
      fileId,
      { 
        filename: file.originalFilename,
        size: file.fileSize,
        blobName: file.blobFilename
      }
    )

    return NextResponse.json({
      success: true,
      message: "File deleted successfully"
    })

  } catch (error) {
    console.error('File deletion error:', error)
    
    // Check if it's an authentication error
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to delete file",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}