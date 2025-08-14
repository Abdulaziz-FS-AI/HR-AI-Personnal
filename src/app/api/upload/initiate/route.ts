import { NextRequest, NextResponse } from "next/server"
import { requireUserContext, checkUserQuota, logDataAccess, validateResourceOwnership } from "@/lib/security/user-context"
import { withRateLimit } from "@/lib/security/rate-limit"
import { z } from "zod"
import { getBlobStorageService } from "@/lib/azure/blob-storage"
import { getServiceBusService } from "@/lib/azure/service-bus"
import { createUploadSession, createFile, addToProcessingQueue } from "@/lib/db-files"
import { getUserRole } from "@/lib/db-secure"
import { randomBytes } from "crypto"

const initiateUploadSchema = z.object({
  files: z.array(z.object({
    filename: z.string().min(1, "Filename is required"),
    size: z.number().min(1, "File size must be greater than 0").max(10 * 1024 * 1024, "File size cannot exceed 10MB"),
    type: z.string().min(1, "File type is required")
  })).min(1, "At least one file is required").max(100, "Maximum 100 files allowed"),
  roleId: z.string().uuid("Invalid role ID").optional()
})

interface InitiateUploadResponse {
  sessionId: string
  sessionToken: string
  uploadUrls: Array<{
    fileId: string
    filename: string
    uploadUrl: string
    blobName: string
  }>
  expiresAt: string
}

export async function POST(request: NextRequest) {
  try {
    // Secure user context validation
    const userContext = await requireUserContext(request)
    
    // Apply rate limiting for upload endpoint
    const rateLimitCheck = await withRateLimit(
      request,
      userContext.userId,
      userContext.subscriptionTier,
      'upload'
    )
    if (!rateLimitCheck.allowed) return rateLimitCheck.response

    const body = await request.json()
    
    // Validate input data
    const validationResult = initiateUploadSchema.safeParse(body)
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

    const { files, roleId } = validationResult.data

    // Check user quota for files
    const fileQuota = await checkUserQuota(userContext.userId, 'files')
    if (!fileQuota.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          message: `File limit reached (${fileQuota.current}/${fileQuota.limit}). Please delete old files or upgrade your plan.`,
          quota: fileQuota
        },
        { status: 429 }
      )
    }

    // Check if adding these files would exceed quota
    if (fileQuota.current + files.length > fileQuota.limit) {
      const remaining = fileQuota.limit - fileQuota.current
      return NextResponse.json(
        { 
          success: false, 
          message: `Cannot upload ${files.length} files. You have ${remaining} slots remaining out of ${fileQuota.limit}.`,
          quota: fileQuota
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
          { action: 'UPLOAD_TO_ROLE' }
        )
        
        return NextResponse.json(
          { success: false, message: "Role not found or access denied" },
          { status: 404 }
        )
      }
    }

    // Validate all files
    const blobService = getBlobStorageService()
    const fileValidationErrors: Array<{ filename: string; error: string }> = []

    for (const file of files) {
      const validation = blobService.validateFile(file.filename, file.size, file.type)
      if (!validation.valid) {
        fileValidationErrors.push({
          filename: file.filename,
          error: validation.error || "Invalid file"
        })
      }
    }

    if (fileValidationErrors.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: "File validation failed",
          fileErrors: fileValidationErrors
        },
        { status: 400 }
      )
    }

    // Generate session token
    const sessionToken = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Create upload session
    const uploadSession = await createUploadSession({
      userId: userContext.userId,
      roleId: roleId || null,
      sessionToken,
      totalFiles: files.length,
      status: 'active',
      expiresAt
    })

    if (!uploadSession) {
      return NextResponse.json(
        { success: false, message: "Failed to create upload session" },
        { status: 500 }
      )
    }

    // Generate upload URLs and create file records
    const uploadUrls: InitiateUploadResponse['uploadUrls'] = []
    const serviceBus = getServiceBusService()

    for (const file of files) {
      try {
        // Generate upload URL with user isolation
        const uploadUrlResponse = await blobService.generateUploadUrl({
          fileName: file.filename,
          userId: userContext.userId,
          fileSize: file.size,
          contentType: file.type
        })

        // Create file record in database
        const fileRecord = await createFile({
          userId: userContext.userId,
          roleId: roleId || null,
          originalFilename: file.filename,
          blobFilename: uploadUrlResponse.blobName,
          fileSize: file.size,
          mimeType: file.type,
          blobUrl: blobService.getBlobUrl(uploadUrlResponse.blobName),
          uploadStatus: 'pending',
          processingStatus: 'not_started'
        })

        if (!fileRecord) {
          throw new Error(`Failed to create file record for ${file.filename}`)
        }

        // Add to processing queue (will be processed after upload)
        await addToProcessingQueue({
          fileId: fileRecord.id,
          queueType: 'file_processing',
          priority: 5, // Default priority
          status: 'pending',
          maxRetries: 3,
          scheduledAt: new Date()
        })

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

    // Log upload initiation
    await logDataAccess(
      userContext.userId,
      'INITIATE_UPLOAD',
      'upload_session',
      uploadSession.id,
      { 
        fileCount: files.length,
        totalSize: totalSize,
        roleId: roleId
      }
    )

    const response: InitiateUploadResponse = {
      sessionId: uploadSession.id,
      sessionToken: uploadSession.sessionToken,
      uploadUrls,
      expiresAt: expiresAt.toISOString()
    }

    return NextResponse.json({
      success: true,
      data: response,
      message: `Upload session created for ${files.length} files`,
      quota: {
        files: {
          used: fileQuota.current + files.length,
          limit: fileQuota.limit
        },
        storage: {
          used: Math.round(storageQuota.current + storageMB),
          limit: storageQuota.limit
        }
      }
    })

  } catch (error) {
    console.error('Upload initiation error:', error)
    
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
        message: "Failed to initiate upload",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}