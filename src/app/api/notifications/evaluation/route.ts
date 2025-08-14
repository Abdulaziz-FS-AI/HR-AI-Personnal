import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  try {
    // Verify internal API key
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.INTERNAL_API_KEY

    if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const data = await request.json()
    
    // Log the notification
    console.log('📧 Evaluation completion notification:', {
      evaluationId: data.evaluationId,
      userEmail: data.userEmail,
      processedCount: data.processedCount,
      avgScore: data.avgScore
    })

    // Send email if SMTP is configured
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      })

      const vercelUrl = process.env.NEXTAUTH_URL || 'https://your-app.vercel.app'
      const resultsUrl = `${vercelUrl}/evaluations/${data.evaluationId}/results`

      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'HR AI SaaS <noreply@hr-ai-saas.com>',
        to: data.userEmail,
        subject: `✅ Evaluation Complete: ${data.roleTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">Evaluation Processing Complete! 🎉</h2>
            
            <p>Your evaluation for <strong>${data.roleTitle}</strong> has been completed.</p>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
              <h3>Results Summary:</h3>
              <ul>
                <li><strong>Total Files:</strong> ${data.totalFiles}</li>
                <li><strong>Successfully Processed:</strong> ${data.processedCount}</li>
                ${data.failedCount > 0 ? `<li><strong>Failed:</strong> ${data.failedCount}</li>` : ''}
                <li><strong>Average Score:</strong> ${data.avgScore}%</li>
              </ul>
            </div>

            <p>
              <a href="${resultsUrl}" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Detailed Results
              </a>
            </p>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              You can access your results anytime from your dashboard.
            </p>
          </div>
        `
      })

      console.log(`✅ Email sent to ${data.userEmail}`)
    }

    // Store notification in database (optional)
    // You could add database storage here for in-app notifications

    return NextResponse.json({
      success: true,
      message: 'Notification processed successfully'
    })

  } catch (error) {
    console.error('Error processing notification:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to process notification',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}