import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getFilesByUserId } from "@/lib/db-files"

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

    // Get files for user, optionally filtered by role
    const files = await getFilesByUserId(session.user.id, roleId || undefined)

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

    return NextResponse.json({
      success: true,
      data: {
        files,
        summary
      }
    })

  } catch (error) {
    console.error('Files fetch error:', error)
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