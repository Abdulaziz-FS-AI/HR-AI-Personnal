import { NextRequest, NextResponse } from "next/server"
import { requireUserContext, checkUserQuota, logDataAccess, validateResourceOwnership } from "@/lib/security/user-context"
import { withRateLimit } from "@/lib/security/rate-limit"
import { z } from "zod"
import { getBlobStorageService } from "@/lib/azure/blob-storage"
import { getServiceBusService } from "@/lib/azure/service-bus"
import { createBatchSession, createFile, queueBulkProcessing } from "@/lib/db-files"
import { randomBytes } from "crypto"
import { sendBulkProcessingNotification } from "@/lib/notifications"

const bulkUploadSchema = z.object({
  files: z.array(z.object({
    filename: z.string().min(1, "Filename is required"),
    size: z.number().min(1, "File size must be greater than 0").max(10 * 1024 * 1024, "File size cannot exceed 10MB"),
    type: z.string().refine(type => type === 'application/pdf' || type.endsWith('/pdf'), "Only PDF files are allowed")
  })).min(1, "At least one file is required").max(150, "Maximum 150 files allowed per bulk upload"),
  roleId: z.string().uuid("Invalid role ID").optional(),
  notificationEmail: z.string().email().optional(),
  processingPriority: z.enum(["low", "normal", "high"]).default("normal")
})

interface BulkUploadResponse {
  sessionId: string
  sessionToken: string
  uploadUrls: Array<{
    fileId: string
    filename: string
    uploadUrl: string
    blobName: string
  }>
  estimatedProcessingTime: string
  notificationMethod: string
  expiresAt: string
}

export async function POST(request: NextRequest) {
  try {
    // Secure user context validation
    const userContext = await requireUserContext(request)
    
    // Apply rate limiting for bulk upload endpoint
    const rateLimitCheck = await withRateLimit(
      request,
      userContext.userId,
      userContext.subscriptionTier,
      'bulk_upload'
    )
    if (!rateLimitCheck.allowed) return rateLimitCheck.response

    const body = await request.json()
    
    // Validate input data
    const validationResult = bulkUploadSchema.safeParse(body)
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

    const { files, roleId, notificationEmail, processingPriority } = validationResult.data

    // Check bulk upload quota
    const bulkQuota = await checkUserQuota(userContext.userId, 'bulk_files')
    if (!bulkQuota.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Bulk upload limit reached (${bulkQuota.current}/${bulkQuota.limit} files this month). Please delete old files or upgrade your plan.`,
          quota: bulkQuota
        },
        { status: 429 }
      )
    }

    // Check if adding these files would exceed quota
    if (bulkQuota.current + files.length > bulkQuota.limit) {
      const remaining = bulkQuota.limit - bulkQuota.current
      return NextResponse.json(
        { 
          success: false, 
          message: `Cannot upload ${files.length} files. You have ${remaining} slots remaining out of ${bulkQuota.limit}.`,
          quota: bulkQuota
        },
        { status: 429 }
      )
    }

    // Check storage quota
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    const storageMB = totalSize / 1048576
    const storageQuota = await checkUserQuota(userContext.userId, 'storage')
    
    if (!storageQuota.allowed || (storageQuota.current + storageMB) > storageQuota.limit) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Storage limit would be exceeded. Current: ${storageQuota.current}MB, Limit: ${storageQuota.limit}MB`,
          quota: storageQuota
        },
        { status: 429 }
      )
    }

    // Verify role ownership if roleId is provided
    if (roleId) {
      const hasAccess = await validateResourceOwnership(roleId, userContext.userId, 'role')
      if (!hasAccess) {
        await logDataAccess(
          userContext.userId,
          'UNAUTHORIZED_ACCESS_ATTEMPT',
          'role',
          roleId,
          { action: 'BULK_UPLOAD_TO_ROLE' }
        )
        
        return NextResponse.json(
          { success: false, message: "Role not found or access denied" },
          { status: 404 }
        )
      }
    }

    // Generate session token
    const sessionToken = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours for bulk uploads

    // Calculate estimated processing time
    const estimatedMinutes = Math.ceil(files.length * 1.5) // ~1.5 minutes per file
    const estimatedTime = estimatedMinutes > 60 
      ? `${Math.ceil(estimatedMinutes / 60)} hours` 
      : `${estimatedMinutes} minutes`

    // Create bulk processing session
    const batchSession = await createBatchSession({
      userId: userContext.userId,
      roleId: roleId || null,
      sessionToken,
      totalFiles: files.length,
      status: 'pending',
      priority: processingPriority,
      notificationEmail: notificationEmail || userContext.email,
      estimatedCompletionTime: new Date(Date.now() + estimatedMinutes * 60 * 1000),
      expiresAt
    })

    if (!batchSession) {
      return NextResponse.json(
        { success: false, message: "Failed to create bulk processing session" },
        { status: 500 }
      )
    }

    // Generate upload URLs and create file records
    const uploadUrls: BulkUploadResponse['uploadUrls'] = []
    const blobService = getBlobStorageService()

    for (const [index, file] of files.entries()) {
      try {
        // Generate upload URL with user isolation
        const uploadUrlResponse = await blobService.generateUploadUrl({
          fileName: file.filename,
          userId: userContext.userId,
          fileSize: file.size,
          contentType: file.type,
          sessionId: batchSession.id
        })

        // Create file record in database
        const fileRecord = await createFile({
          userId: userContext.userId,
          sessionId: batchSession.id,
          roleId: roleId || null,
          originalFilename: file.filename,
          blobFilename: uploadUrlResponse.blobName,
          fileSize: file.size,
          mimeType: file.type,
          blobUrl: blobService.getBlobUrl(uploadUrlResponse.blobName),
          uploadStatus: 'pending',
          processingStatus: 'not_started',
          processingOrder: index + 1 // Order for batch processing
        })

        if (!fileRecord) {
          throw new Error(`Failed to create file record for ${file.filename}`)
        }

        uploadUrls.push({
          fileId: fileRecord.id,
          filename: file.filename,
          uploadUrl: uploadUrlResponse.uploadUrl,
          blobName: uploadUrlResponse.blobName
        })

      } catch (error) {
        console.error(`Error processing file ${file.filename}:`, error)
        return NextResponse.json(
          { 
            success: false, 
            message: `Failed to process file: ${file.filename}`,
            error: error instanceof Error ? error.message : "Unknown error"
          },
          { status: 500 }
        )
      }
    }

    // Queue bulk processing (will start after uploads complete)
    await queueBulkProcessing({
      sessionId: batchSession.id,
      userId: userContext.userId,
      roleId: roleId || null,
      priority: processingPriority === 'high' ? 1 : processingPriority === 'low' ? 10 : 5,
      fileCount: files.length,
      estimatedTimeMinutes: estimatedMinutes
    })

    // Send immediate notification about upload initiation
    try {
      await sendBulkProcessingNotification({
        type: 'upload_initiated',
        sessionId: batchSession.id,
        userId: userContext.userId,
        email: notificationEmail || userContext.email,
        fileCount: files.length,
        estimatedTime: estimatedTime
      })
    } catch (notificationError) {
      console.warn('Failed to send upload notification:', notificationError)
      // Don't fail the request for notification errors
    }

    // Log bulk upload initiation
    await logDataAccess(
      userContext.userId,
      'INITIATE_BULK_UPLOAD',
      'batch_session',
      batchSession.id,
      { 
        fileCount: files.length,
        totalSize: totalSize,
        roleId: roleId,
        priority: processingPriority,
        estimatedTimeMinutes: estimatedMinutes
      }
    )

    const response: BulkUploadResponse = {
      sessionId: batchSession.id,
      sessionToken: batchSession.sessionToken,
      uploadUrls,
      estimatedProcessingTime: estimatedTime,
      notificationMethod: notificationEmail ? 'email' : 'dashboard',
      expiresAt: expiresAt.toISOString()
    }

    return NextResponse.json({
      success: true,
      data: response,
      message: `Bulk upload session created for ${files.length} files. You'll be notified when processing is complete.`,
      instructions: {
        next: "Upload your files using the provided URLs",
        notification: "Processing will start automatically after all files are uploaded",
        tracking: `Monitor progress at /dashboard/processing/${batchSession.id}`
      },
      quota: {
        files: {
          used: bulkQuota.current + files.length,
          limit: bulkQuota.limit
        },
        storage: {
          used: Math.round(storageQuota.current + storageMB),
          limit: storageQuota.limit
        }
      }
    })

  } catch (error) {
    console.error('Bulk upload initiation error:', error)
    
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
        message: "Failed to initiate bulk upload",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}