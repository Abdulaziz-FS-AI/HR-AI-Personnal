import { NextRequest, NextResponse } from 'next/server'
import { sendBulkProcessingNotification } from '@/lib/notifications'
import { z } from 'zod'

const notificationSchema = z.object({
  type: z.enum(['upload_initiated', 'processing_started', 'processing_completed', 'processing_failed']),
  sessionId: z.string(),
  userId: z.string(),
  email: z.string().email(),
  fileCount: z.number(),
  estimatedTime: z.string().optional(),
  completedCount: z.number().optional(),
  failedCount: z.number().optional(),
  avgScore: z.number().optional(),
  roleTitle: z.string().optional(),
  errorMessage: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    // Verify internal API key for security
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.INTERNAL_API_KEY

    if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate notification data
    const validationResult = notificationSchema.safeParse(body)
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

    const notificationData = validationResult.data

    // Send notification
    await sendBulkProcessingNotification(notificationData)

    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully'
    })

  } catch (error) {
    console.error('Error sending notification:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to send notification",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}