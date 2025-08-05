import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getUploadSession, getSessionFiles } from "@/lib/db-files"

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
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
    }

    const { sessionId } = await params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json(
        { success: false, message: "Invalid session ID format" },
        { status: 400 }
      )
    }

    // Get upload session
    const uploadSession = await getUploadSession(sessionId)
    if (!uploadSession) {
      return NextResponse.json(
        { success: false, message: "Upload session not found" },
        { status: 404 }
      )
    }

    // Verify session belongs to user
    if (uploadSession.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, message: "Access denied" },
        { status: 403 }
      )
    }

    // Get all files in this session
    const sessionFiles = await getSessionFiles(sessionId)

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

    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error) {
    console.error('Upload progress error:', error)
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