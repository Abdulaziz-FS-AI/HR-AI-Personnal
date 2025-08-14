import { NextRequest, NextResponse } from "next/server"
import { requireUserContext, logDataAccess } from "@/lib/security/user-context"
import { withRateLimit } from "@/lib/security/rate-limit"
import { getUserFiles } from "@/lib/db-secure"

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const roleId = searchParams.get('roleId')

    // Get files with built-in user isolation
    const files = await getUserFiles(userContext.userId, {
      roleId: roleId || undefined
    })

    // Group files by status for summary
    const summary = {
      total: files.length,
      byUploadStatus: {
        pending: files.filter(f => f.uploadStatus === 'pending').length,
        uploading: files.filter(f => f.uploadStatus === 'uploading').length,
        completed: files.filter(f => f.uploadStatus === 'completed').length,
        failed: files.filter(f => f.uploadStatus === 'failed').length
      },
      byProcessingStatus: {
        not_started: files.filter(f => f.processingStatus === 'not_started').length,
        extracting: files.filter(f => f.processingStatus === 'extracting').length,
        analyzing: files.filter(f => f.processingStatus === 'analyzing').length,
        completed: files.filter(f => f.processingStatus === 'completed').length,
        failed: files.filter(f => f.processingStatus === 'failed').length
      },
      analyzed: files.filter(f => f.aiScore !== null).length
    }

    // Log data access for audit
    await logDataAccess(
      userContext.userId,
      'LIST_FILES',
      'files',
      'multiple',
      { 
        count: files.length,
        roleId: roleId,
        summary: summary
      }
    )

    return NextResponse.json({
      success: true,
      data: {
        files,
        summary
      }
    })

  } catch (error) {
    console.error('Files fetch error:', error)
    
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
        message: "Failed to fetch files",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}