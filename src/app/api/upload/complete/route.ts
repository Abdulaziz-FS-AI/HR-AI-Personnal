import { NextRequest, NextResponse } from "next/server"
import { requireUserContext, logDataAccess } from "@/lib/security/user-context"
import { withRateLimit } from "@/lib/security/rate-limit"
import { z } from "zod"
import { getServiceBusService, type FileProcessingMessage } from "@/lib/azure/service-bus"
import { 
  getUserUploadSessionByToken, 
  updateUserUploadSession, 
  updateUserFileStatus, 
  getUserFileById 
} from "@/lib/db-secure"
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
    // Authenticate user and get secure context
    const userContext = await requireUserContext(request)
    
    // Apply rate limiting for upload operations
    const rateLimitResult = await withRateLimit(
      request,
      userContext.userId,
      userContext.subscriptionTier,
      'upload'
    )
    
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!
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

    // Get upload session using secure function (automatically validates ownership)
    const uploadSession = await getUserUploadSessionByToken(userContext.userId, sessionToken)
    if (!uploadSession) {
      await logDataAccess(
        userContext.userId,
        'unauthorized_session_access',
        'upload_session',
        sessionToken,
        { action: 'POST', endpoint: '/api/upload/complete' }
      )
      
      return NextResponse.json(
        { success: false, message: "Upload session not found" },
        { status: 404 }
      )
    }

    // Check if session is expired
    if (new Date() > uploadSession.expiresAt) {
      await logDataAccess(
        userContext.userId,
        'expired_session_access',
        'upload_session',
        uploadSession.id,
        { action: 'POST', endpoint: '/api/upload/complete', expiresAt: uploadSession.expiresAt }
      )
      
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
        const fileRecord = await getUserFileById(userContext.userId, fileResult.fileId)
        if (!fileRecord) {
          await logDataAccess(
            userContext.userId,
            'file_not_found',
            'file',
            fileResult.fileId,
            { action: 'upload_complete', endpoint: '/api/upload/complete' }
          )
          console.error(`File record not found: ${fileResult.fileId}`)
          failedUploads++
          continue
        }

        if (fileResult.status === "success") {
          // Verify the blob actually exists
          const blobExists = await blobService.blobExists(fileRecord.blobFilename)
          
          if (blobExists) {
            // Update file status to completed using secure function
            await updateUserFileStatus(userContext.userId, fileResult.fileId, {
              uploadStatus: 'completed'
            })

            // Log successful file completion
            await logDataAccess(
              userContext.userId,
              'file_upload_completed',
              'file',
              fileRecord.id,
              { 
                filename: fileRecord.originalFilename,
                fileSize: fileRecord.fileSize,
                sessionId: uploadSession.id,
                endpoint: '/api/upload/complete'
              }
            )

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
            await updateUserFileStatus(userContext.userId, fileResult.fileId, {
              uploadStatus: 'failed'
            })
            
            await logDataAccess(
              userContext.userId,
              'blob_verification_failed',
              'file',
              fileRecord.id,
              { 
                filename: fileRecord.originalFilename,
                blobFilename: fileRecord.blobFilename,
                endpoint: '/api/upload/complete'
              }
            )
            failedUploads++
          }
        } else {
          // Upload failed
          await updateUserFileStatus(userContext.userId, fileResult.fileId, {
            uploadStatus: 'failed'
          })
          
          await logDataAccess(
            userContext.userId,
            'file_upload_failed',
            'file',
            fileRecord.id,
            { 
              filename: fileRecord.originalFilename,
              error: fileResult.error,
              endpoint: '/api/upload/complete'
            }
          )
          failedUploads++
        }

      } catch (error) {
        console.error(`Error processing file result ${fileResult.fileId}:`, error)
        await logDataAccess(
          userContext.userId,
          'file_processing_error',
          'file',
          fileResult.fileId,
          { 
            error: error instanceof Error ? error.message : 'Unknown error',
            endpoint: '/api/upload/complete'
          }
        )
        failedUploads++
      }
    }

    // Update upload session using secure function
    const sessionStatus = failedUploads === fileResults.length ? 'failed' : 
                         successfulUploads === fileResults.length ? 'completed' : 'completed'

    await updateUserUploadSession(userContext.userId, uploadSession.id, {
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

    // Log successful upload completion
    await logDataAccess(
      userContext.userId,
      'upload_session_completed',
      'upload_session',
      uploadSession.id,
      { 
        totalFiles: fileResults.length,
        successfulUploads,
        failedUploads,
        queuedForProcessing: processingMessages.length,
        sessionStatus,
        endpoint: '/api/upload/complete'
      }
    )

    return NextResponse.json({
      success: true,
      data: response,
      message: `Upload completed: ${successfulUploads} successful, ${failedUploads} failed`
    })

  } catch (error) {
    console.error('Upload completion error:', error)
    
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
        message: "Failed to complete upload",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}