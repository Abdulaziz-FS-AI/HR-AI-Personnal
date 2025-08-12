import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDbConnection } from '@/lib/db'
import sql from 'mssql'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pool = await getDbConnection()
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, session.user.id)
      .query(`
        SELECT 
          u.id,
          u.email,
          u.first_name as firstName,
          u.last_name as lastName,
          u.company_name as company,
          u.subscription_tier as subscriptionTier,
          u.credits_remaining as creditsRemaining,
          u.created_at as memberSince
        FROM users u
        WHERE u.id = @userId
      `)
    
    const user = result.recordset[0]
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Map database values to settings structure
    const settings = {
      profile: {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        company: user.company || '',
        phone: '',
        timezone: 'America/New_York'
      },
      billing: {
        subscriptionTier: user.subscriptionTier || 'free',
        creditsUsed: 10 - (user.creditsRemaining || 10),
        creditsTotal: 10,
        memberSince: user.memberSince
      },
      notifications: {
        email: true,
        sms: false,
        evaluationComplete: true,
        weeklyReport: true,
        systemUpdates: false
      },
      privacy: {
        analyticsTracking: true,
        dataProfiling: false,
        thirdPartyIntegrations: true
      }
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Settings fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updates = await request.json()
    
    // Update profile information
    if (updates.profile) {
      const pool = await getDbConnection()
      await pool.request()
        .input('userId', sql.UniqueIdentifier, session.user.id)
        .input('firstName', sql.NVarChar, updates.profile.firstName)
        .input('lastName', sql.NVarChar, updates.profile.lastName)
        .input('company', sql.NVarChar, updates.profile.company)
        .query(`
          UPDATE users
          SET 
            first_name = @firstName,
            last_name = @lastName,
            company_name = @company
          WHERE id = @userId
        `)
    }

    // In a real app, notification and privacy settings would be stored in separate tables
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}