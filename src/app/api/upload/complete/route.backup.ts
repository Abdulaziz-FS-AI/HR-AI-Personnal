import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { z } from "zod"
import { getServiceBusService, type FileProcessingMessage } from "@/lib/azure/service-bus"
import { 
  getUploadSessionByToken, 
  updateUploadSession, 
  updateFileStatus, 
  getFileById 
} from "@/lib/db-files"
import { getBlobStorageService } from "@/lib/azure/blob-storage"

const completeUploadSchema = z.object({
  sessionToken: z.string().min(1, "Session token is required"),
  fileResults: z.array(z.object({
    fileId: z.string().uuid("Invalid file ID"),
    status: z.enum(["success", "failed"]),
    error: z.string().optional()
  }))
})

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
    const validationResult = completeUploadSchema.safeParse(body)
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

    const { sessionToken, fileResults } = validationResult.data

    // Get upload session
    const uploadSession = await getUploadSessionByToken(sessionToken)
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

    // Check if session is expired
    if (new Date() > uploadSession.expiresAt) {
      return NextResponse.json(
        { success: false, message: "Upload session expired" },
        { status: 410 }
      )
    }

    const blobService = getBlobStorageService()
    const serviceBus = getServiceBusService()
    
    let successfulUploads = 0
    let failedUploads = 0
    const processingMessages: FileProcessingMessage[] = []

    // Process each file result
    for (const fileResult of fileResults) {
      try {
        const fileRecord = await getFileById(fileResult.fileId)
        if (!fileRecord) {
          console.error(`File record not found: ${fileResult.fileId}`)
          failedUploads++
          continue
        }

        // Verify file belongs to user
        if (fileRecord.userId !== session.user.id) {
          console.error(`File access denied: ${fileResult.fileId}`)
          failedUploads++
          continue
        }

        if (fileResult.status === "success") {
          // Verify the blob actually exists
          const blobExists = await blobService.blobExists(fileRecord.blobFilename)
          
          if (blobExists) {
            // Update file status to completed
            await updateFileStatus(fileResult.fileId, {
              uploadStatus: 'completed'
            })

            // Queue for processing
            const processingMessage: FileProcessingMessage = {
              fileId: fileRecord.id,
              userId: fileRecord.userId,
              roleId: fileRecord.roleId || undefined,
              sessionId: uploadSession.id,
              blobName: fileRecord.blobFilename,
              fileName: fileRecord.originalFilename,
              priority: 5 // Default priority
            }

            processingMessages.push(processingMessage)
            successfulUploads++
          } else {
            // Blob doesn't exist, mark as failed
            await updateFileStatus(fileResult.fileId, {
              uploadStatus: 'failed'
            })
            failedUploads++
          }
        } else {
          // Upload failed
          await updateFileStatus(fileResult.fileId, {
            uploadStatus: 'failed'
          })
          failedUploads++
        }

      } catch (error) {
        console.error(`Error processing file result ${fileResult.fileId}:`, error)
        failedUploads++
      }
    }

    // Update upload session
    const sessionStatus = failedUploads === fileResults.length ? 'failed' : 
                         successfulUploads === fileResults.length ? 'completed' : 'completed'

    await updateUploadSession(uploadSession.id, {
      uploadedFiles: successfulUploads,
      failedFiles: failedUploads,
      status: sessionStatus
    })

    // Queue successful files for processing
    if (processingMessages.length > 0) {
      try {
        await serviceBus.queueBatchForProcessing(processingMessages)
        console.log(`Queued ${processingMessages.length} files for processing`)
      } catch (error) {
        console.error('Error queueing files for processing:', error)
        // Don't fail the request if queueing fails - files can be processed later
      }
    }

    const response = {
      sessionId: uploadSession.id,
      totalFiles: fileResults.length,
      successfulUploads,
      failedUploads,
      queuedForProcessing: processingMessages.length,
      sessionStatus
    }

    return NextResponse.json({
      success: true,
      data: response,
      message: `Upload completed: ${successfulUploads} successful, ${failedUploads} failed`
    })

  } catch (error) {
    console.error('Upload completion error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to complete upload",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}