import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { z } from "zod"
import { getBlobStorageService } from "@/lib/azure/blob-storage"
import { getServiceBusService } from "@/lib/azure/service-bus"
import { createUploadSession, createFile, addToProcessingQueue } from "@/lib/db-files"
import { getRoleById } from "@/lib/db"
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
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      )
    }

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

    // Verify role belongs to user if roleId is provided
    if (roleId) {
      const role = await getRoleById(roleId, session.user.id)
      if (!role) {
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
      userId: session.user.id,
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
        // Generate upload URL
        const uploadUrlResponse = await blobService.generateUploadUrl({
          fileName: file.filename,
          userId: session.user.id,
          fileSize: file.size,
          contentType: file.type
        })

        // Create file record in database
        const fileRecord = await createFile({
          userId: session.user.id,
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

    const response: InitiateUploadResponse = {
      sessionId: uploadSession.id,
      sessionToken: uploadSession.sessionToken,
      uploadUrls,
      expiresAt: expiresAt.toISOString()
    }

    return NextResponse.json({
      success: true,
      data: response,
      message: `Upload session created for ${files.length} files`
    })

  } catch (error) {
    console.error('Upload initiation error:', error)
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