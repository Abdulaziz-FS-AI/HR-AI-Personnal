import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getFileById, updateFileStatus } from "@/lib/db-files"
import { getBlobStorageService } from "@/lib/azure/blob-storage"

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/files/[id] - Get specific file details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
    }

    const { id: fileId } = await params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(fileId)) {
      return NextResponse.json(
        { success: false, message: "Invalid file ID format" },
        { status: 400 }
      )
    }

    const file = await getFileById(fileId)
    
    if (!file) {
      return NextResponse.json(
        { success: false, message: "File not found" },
        { status: 404 }
      )
    }

    // Verify file belongs to user
    if (file.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, message: "Access denied" },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: file
    })

  } catch (error) {
    console.error('File fetch error:', error)
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

// DELETE /api/files/[id] - Delete file and blob
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
    }

    const { id: fileId } = await params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(fileId)) {
      return NextResponse.json(
        { success: false, message: "Invalid file ID format" },
        { status: 400 }
      )
    }

    const file = await getFileById(fileId)
    
    if (!file) {
      return NextResponse.json(
        { success: false, message: "File not found" },
        { status: 404 }
      )
    }

    // Verify file belongs to user
    if (file.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, message: "Access denied" },
        { status: 403 }
      )
    }

    // Delete blob from Azure Storage
    const blobService = getBlobStorageService()
    try {
      await blobService.deleteBlob(file.blobFilename)
    } catch (blobError) {
      console.error('Error deleting blob:', blobError)
      // Continue with database deletion even if blob deletion fails
    }

    // Mark file as inactive in database (soft delete)
    const deleted = await updateFileStatus(fileId, {
      uploadStatus: 'failed' // Mark as failed so it won't be processed
    })

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Failed to delete file" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "File deleted successfully"
    })

  } catch (error) {
    console.error('File deletion error:', error)
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

// GET /api/files/[id]/download - Generate download URL
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
    }

    const { id: fileId } = await params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(fileId)) {
      return NextResponse.json(
        { success: false, message: "Invalid file ID format" },
        { status: 400 }
      )
    }

    const file = await getFileById(fileId)
    
    if (!file) {
      return NextResponse.json(
        { success: false, message: "File not found" },
        { status: 404 }
      )
    }

    // Verify file belongs to user
    if (file.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, message: "Access denied" },
        { status: 403 }
      )
    }

    // Check if file upload is completed
    if (file.uploadStatus !== 'completed') {
      return NextResponse.json(
        { success: false, message: "File upload not completed" },
        { status: 400 }
      )
    }

    // Generate download URL
    const blobService = getBlobStorageService()
    const downloadUrl = await blobService.generateDownloadUrl(file.blobFilename, 1) // 1 hour expiry

    return NextResponse.json({
      success: true,
      data: {
        downloadUrl,
        filename: file.originalFilename,
        fileSize: file.fileSize,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      }
    })

  } catch (error) {
    console.error('File download URL generation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to generate download URL",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}