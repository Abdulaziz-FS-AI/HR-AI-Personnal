import nodemailer from 'nodemailer'

interface NotificationData {
  type: 'upload_initiated' | 'processing_started' | 'processing_completed' | 'processing_failed'
  sessionId: string
  userId: string
  email: string
  fileCount: number
  estimatedTime?: string
  completedCount?: number
  failedCount?: number
  avgScore?: number
  roleTitle?: string
  errorMessage?: string
}

class NotificationService {
  private transporter: nodemailer.Transporter | null = null

  constructor() {
    this.initializeTransporter()
  }

  private async initializeTransporter() {
    // Only initialize if email credentials are provided
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      })
    }
  }

  async sendBulkProcessingNotification(data: NotificationData): Promise<void> {
    // Log notification attempt
    console.log(`Sending ${data.type} notification for session ${data.sessionId} to ${data.email}`)

    // Send email if transporter is available
    if (this.transporter) {
      try {
        await this.sendEmailNotification(data)
      } catch (error) {
        console.error('Failed to send email notification:', error)
        // Continue to in-app notification
      }
    }

    // Always create in-app notification
    await this.createInAppNotification(data)
  }

  private async sendEmailNotification(data: NotificationData): Promise<void> {
    if (!this.transporter) return

    const subject = this.getEmailSubject(data)
    const html = this.getEmailTemplate(data)

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || 'HR AI SaaS <noreply@hr-ai-saas.com>',
      to: data.email,
      subject,
      html
    })
  }

  private getEmailSubject(data: NotificationData): string {
    switch (data.type) {
      case 'upload_initiated':
        return `Bulk Upload Started - ${data.fileCount} files queued for processing`
      case 'processing_started':
        return `Resume Processing Started - ${data.fileCount} files`
      case 'processing_completed':
        return `Resume Processing Complete - ${data.completedCount}/${data.fileCount} files processed`
      case 'processing_failed':
        return `Resume Processing Failed - Session ${data.sessionId}`
      default:
        return 'HR AI SaaS Notification'
    }
  }

  private getEmailTemplate(data: NotificationData): string {
    const baseUrl = process.env.NEXTAUTH_URL || 'https://your-app.vercel.app'
    const dashboardUrl = `${baseUrl}/dashboard/processing/${data.sessionId}`

    switch (data.type) {
      case 'upload_initiated':
        return `
          <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">
            <h2 style=\"color: #2563eb;\">Bulk Upload Initiated</h2>
            <p>Your bulk upload has been successfully initiated!</p>
            
            <div style=\"background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;\">
              <h3>Upload Details:</h3>
              <ul>
                <li><strong>Files:</strong> ${data.fileCount} PDF resumes</li>
                <li><strong>Estimated Processing Time:</strong> ${data.estimatedTime}</li>
                <li><strong>Session ID:</strong> ${data.sessionId}</li>
              </ul>
            </div>

            <p>Next steps:</p>
            <ol>
              <li>Complete uploading all your PDF files</li>
              <li>Processing will start automatically once uploads finish</li>
              <li>You'll receive another notification when processing is complete</li>
            </ol>

            <p>
              <a href=\"${dashboardUrl}\" style=\"background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;\">
                Track Progress
              </a>
            </p>

            <p style=\"color: #666; font-size: 14px; margin-top: 30px;\">
              This is an automated message from HR AI SaaS. You can track your processing progress in the dashboard.
            </p>
          </div>
        `

      case 'processing_completed':
        return `
          <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">
            <h2 style=\"color: #059669;\">Resume Processing Complete! 🎉</h2>
            <p>Your bulk resume processing has finished successfully.</p>
            
            <div style=\"background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;\">
              <h3>Processing Results:</h3>
              <ul>
                <li><strong>Total Files:</strong> ${data.fileCount}</li>
                <li><strong>Successfully Processed:</strong> ${data.completedCount}</li>
                ${data.failedCount ? `<li><strong>Failed:</strong> ${data.failedCount}</li>` : ''}
                ${data.avgScore ? `<li><strong>Average Score:</strong> ${data.avgScore}%</li>` : ''}
                ${data.roleTitle ? `<li><strong>Role:</strong> ${data.roleTitle}</li>` : ''}
              </ul>
            </div>

            <p>
              <a href=\"${dashboardUrl}\" style=\"background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;\">
                View Results
              </a>
            </p>

            <p style=\"color: #666; font-size: 14px; margin-top: 30px;\">
              Your results are now available in the dashboard. You can export reports, filter candidates, and analyze the data.
            </p>
          </div>
        `

      case 'processing_failed':
        return `
          <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">
            <h2 style=\"color: #dc2626;\">Processing Failed</h2>
            <p>Unfortunately, there was an issue with your bulk resume processing.</p>
            
            <div style=\"background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;\">
              <h3>Error Details:</h3>
              <p><strong>Session ID:</strong> ${data.sessionId}</p>
              <p><strong>Files:</strong> ${data.fileCount}</p>
              ${data.errorMessage ? `<p><strong>Error:</strong> ${data.errorMessage}</p>` : ''}
            </div>

            <p>Please try again or contact support if the issue persists.</p>

            <p>
              <a href=\"${dashboardUrl}\" style=\"background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;\">
                View Details
              </a>
            </p>
          </div>
        `

      default:
        return `
          <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">
            <h2>HR AI SaaS Notification</h2>
            <p>You have a new notification regarding session ${data.sessionId}.</p>
            <p><a href=\"${dashboardUrl}\">View Dashboard</a></p>
          </div>
        `
    }
  }

  private async createInAppNotification(data: NotificationData): Promise<void> {
    // Store notification in database for in-app display
    try {
      // This would integrate with your database notification system
      const notificationData = {
        userId: data.userId,
        type: data.type,
        title: this.getNotificationTitle(data),
        message: this.getNotificationMessage(data),
        sessionId: data.sessionId,
        isRead: false,
        createdAt: new Date()
      }

      // You would save this to your notifications table
      console.log('In-app notification created:', notificationData)
      
    } catch (error) {
      console.error('Failed to create in-app notification:', error)
    }
  }

  private getNotificationTitle(data: NotificationData): string {
    switch (data.type) {
      case 'upload_initiated':
        return 'Bulk Upload Started'
      case 'processing_started':
        return 'Processing Started'
      case 'processing_completed':
        return 'Processing Complete'
      case 'processing_failed':
        return 'Processing Failed'
      default:
        return 'Notification'
    }
  }

  private getNotificationMessage(data: NotificationData): string {
    switch (data.type) {
      case 'upload_initiated':
        return `${data.fileCount} files queued for processing. Estimated time: ${data.estimatedTime}`
      case 'processing_started':
        return `Started processing ${data.fileCount} resume files`
      case 'processing_completed':
        return `Successfully processed ${data.completedCount}/${data.fileCount} files${data.avgScore ? ` with average score ${data.avgScore}%` : ''}`
      case 'processing_failed':
        return `Processing failed for session ${data.sessionId}${data.errorMessage ? `: ${data.errorMessage}` : ''}`
      default:
        return 'You have a new notification'
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService()

// Export the main function for easy import
export async function sendBulkProcessingNotification(data: NotificationData): Promise<void> {
  return await notificationService.sendBulkProcessingNotification(data)
}

// Export utility function for Azure Functions
export async function notifyProcessingComplete(
  sessionId: string,
  userId: string,
  email: string,
  stats: {
    totalFiles: number
    completedCount: number
    failedCount: number
    avgScore?: number
    roleTitle?: string
  }
): Promise<void> {
  await sendBulkProcessingNotification({
    type: 'processing_completed',
    sessionId,
    userId,
    email,
    fileCount: stats.totalFiles,
    completedCount: stats.completedCount,
    failedCount: stats.failedCount,
    avgScore: stats.avgScore,
    roleTitle: stats.roleTitle
  })
}

export async function notifyProcessingFailed(
  sessionId: string,
  userId: string,
  email: string,
  fileCount: number,
  errorMessage?: string
): Promise<void> {
  await sendBulkProcessingNotification({
    type: 'processing_failed',
    sessionId,
    userId,
    email,
    fileCount,
    errorMessage
  })
}