import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { executeQuery } from '@/lib/db-utils'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await executeQuery(async (pool) => {
      const result = await pool.request()
        .input('userId', session.user.id)
        .query(`
          SELECT 
            u.id,
            u.email,
            u.first_name as firstName,
            u.last_name as lastName,
            u.company_name as company,
            u.phone,
            u.timezone,
            u.subscription_tier as subscriptionTier,
            u.credits_remaining as creditsRemaining,
            u.credits_total as creditsTotal,
            u.created_at as memberSince,
            -- Default notification preferences (would be in separate table in real app)
            CAST(1 as bit) as emailNotifications,
            CAST(0 as bit) as smsNotifications,
            CAST(1 as bit) as evaluationCompleteNotifications,
            CAST(1 as bit) as weeklyReportNotifications,
            CAST(0 as bit) as systemUpdateNotifications,
            -- Default privacy settings
            CAST(1 as bit) as analyticsTracking,
            CAST(0 as bit) as dataProfiling,
            CAST(1 as bit) as thirdPartyIntegrations
          FROM users u
          WHERE u.id = @userId
        `)
      
      const user = result.recordset[0]
      if (!user) return null

      // Map database values to settings structure
      return {
        profile: {
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          company: user.company || '',
          phone: user.phone || '',
          timezone: user.timezone || 'America/New_York'
        },
        billing: {
          subscriptionTier: user.subscriptionTier || 'free',
          creditsUsed: (user.creditsTotal || 10) - (user.creditsRemaining || 10),
          creditsTotal: user.creditsTotal || 10,
          memberSince: user.memberSince
        },
        notifications: {
          email: user.emailNotifications,
          sms: user.smsNotifications,
          evaluationComplete: user.evaluationCompleteNotifications,
          weeklyReport: user.weeklyReportNotifications,
          systemUpdates: user.systemUpdateNotifications
        },
        privacy: {
          analyticsTracking: user.analyticsTracking,
          dataProfiling: user.dataProfiling,
          thirdPartyIntegrations: user.thirdPartyIntegrations
        }
      }
    })

    if (!settings) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Settings fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updates = await request.json()
    
    // Update profile information
    if (updates.profile) {
      await executeQuery(async (pool) => {
        await pool.request()
          .input('userId', session.user.id)
          .input('firstName', updates.profile.firstName)
          .input('lastName', updates.profile.lastName)
          .input('company', updates.profile.company)
          .input('phone', updates.profile.phone)
          .input('timezone', updates.profile.timezone)
          .query(`
            UPDATE users
            SET 
              first_name = @firstName,
              last_name = @lastName,
              company_name = @company,
              phone = @phone,
              timezone = @timezone
            WHERE id = @userId
          `)
      })
    }

    // In a real app, notification and privacy settings would be stored in separate tables
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}