import { NextRequest, NextResponse } from "next/server"
import { requireUserContext, logDataAccess } from "@/lib/security/user-context"
import { withRateLimit } from "@/lib/security/rate-limit"
import { getUserUploadSession, getUserSessionFiles } from "@/lib/db-secure"

interface RouteParams {
  params: Promise<{
    sessionId: string
  }>
}

interface UploadProgressResponse {
  sessionId: string
  sessionToken: string
  totalFiles: number
  uploadedFiles: number
  processedFiles: number
  failedFiles: number
  status: string
  overallProgress: number
  files: Array<{
    fileId: string
    filename: string
    fileSize: number
    uploadStatus: string
    processingStatus: string
    uploadProgress: number
    error?: string
  }>
  expiresAt: string
  createdAt: string
  updatedAt: string
}

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

    const { sessionId } = await params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json(
        { success: false, message: "Invalid session ID format" },
        { status: 400 }
      )
    }

    // Get upload session with built-in user isolation
    const uploadSession = await getUserUploadSession(sessionId, userContext.userId)
    if (!uploadSession) {
      // Log unauthorized access attempt
      await logDataAccess(
        userContext.userId,
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        'upload_session',
        sessionId,
        { action: 'GET_UPLOAD_PROGRESS' }
      )
      
      return NextResponse.json(
        { success: false, message: "Upload session not found or access denied" },
        { status: 404 }
      )
    }

    // Check if session has expired
    if (uploadSession.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, message: "Upload session has expired" },
        { status: 410 }
      )
    }

    // Get all files in this session with user isolation
    const sessionFiles = await getUserSessionFiles(sessionId, userContext.userId)

    // Calculate overall progress
    const totalFiles = uploadSession.totalFiles
    const uploadedFiles = uploadSession.uploadedFiles
    const processedFiles = uploadSession.processedFiles
    const failedFiles = uploadSession.failedFiles

    // Calculate overall progress percentage
    let overallProgress = 0
    if (totalFiles > 0) {
      // Upload progress is 50% of total, processing is the other 50%
      const uploadProgress = (uploadedFiles + failedFiles) / totalFiles * 50
      const processingProgress = processedFiles / totalFiles * 50
      overallProgress = Math.round(uploadProgress + processingProgress)
    }

    // Map files with their current status
    const files = sessionFiles.map(file => ({
      fileId: file.id,
      filename: file.originalFilename,
      fileSize: file.fileSize,
      uploadStatus: file.uploadStatus,
      processingStatus: file.processingStatus,
      uploadProgress: file.uploadStatus === 'completed' ? 100 : 
                     file.uploadStatus === 'failed' ? 0 : 
                     file.uploadStatus === 'uploading' ? 50 : 0,
      ...(file.uploadStatus === 'failed' && { error: 'Upload failed' })
    }))

    const response: UploadProgressResponse = {
      sessionId: uploadSession.id,
      sessionToken: uploadSession.sessionToken,
      totalFiles,
      uploadedFiles,
      processedFiles,
      failedFiles,
      status: uploadSession.status,
      overallProgress,
      files,
      expiresAt: uploadSession.expiresAt.toISOString(),
      createdAt: uploadSession.createdAt.toISOString(),
      updatedAt: uploadSession.updatedAt.toISOString()
    }

    // Log upload progress access for audit
    await logDataAccess(
      userContext.userId,
      'GET_UPLOAD_PROGRESS',
      'upload_session',
      sessionId,
      { 
        totalFiles,
        uploadedFiles,
        processedFiles,
        failedFiles,
        overallProgress,
        status: uploadSession.status
      }
    )

    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error) {
    console.error('Upload progress error:', error)
    
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
        message: "Failed to get upload progress",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}