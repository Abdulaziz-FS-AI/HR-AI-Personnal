import axios from 'axios'

interface BulkProcessingStats {
  totalFiles: number
  processed: number
  failed: number
  avgScore?: number
  roleTitle?: string
}

/**
 * Send notification via Vercel API endpoint
 */
async function sendNotification(type: string, data: any): Promise<void> {
  try {
    const vercelUrl = process.env.VERCEL_APP_URL || process.env.NEXTAUTH_URL
    if (!vercelUrl) {
      console.warn('No Vercel URL configured for notifications')
      return
    }

    const notificationEndpoint = `${vercelUrl}/api/notifications/send`
    
    await axios.post(notificationEndpoint, {
      type,
      ...data
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || ''}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    })

    console.log(`Notification sent successfully: ${type}`)
  } catch (error) {
    console.error(`Failed to send notification (${type}):`, error)
    // Don't throw error - notifications should not break processing
  }
}

/**
 * Notify user that processing has completed
 */
export async function notifyProcessingComplete(
  sessionId: string,
  userId: string,
  email: string,
  stats: BulkProcessingStats
): Promise<void> {
  await sendNotification('processing_completed', {
    sessionId,
    userId,
    email,
    fileCount: stats.totalFiles,
    completedCount: stats.processed,
    failedCount: stats.failed,
    avgScore: stats.avgScore,
    roleTitle: stats.roleTitle
  })
}

/**
 * Notify user that processing has failed
 */
export async function notifyProcessingFailed(
  sessionId: string,
  userId: string,
  email: string,
  fileCount: number,
  errorMessage?: string
): Promise<void> {
  await sendNotification('processing_failed', {
    sessionId,
    userId,
    email,
    fileCount,
    errorMessage
  })
}

/**
 * Notify user that processing has started
 */
export async function notifyProcessingStarted(
  sessionId: string,
  userId: string,
  email: string,
  fileCount: number
): Promise<void> {
  await sendNotification('processing_started', {
    sessionId,
    userId,
    email,
    fileCount
  })
}