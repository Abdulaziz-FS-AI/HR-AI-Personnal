import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserByEmail } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 DEBUG: Checking authentication status...')
    
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({
        success: false,
        message: 'No session found',
        authenticated: false
      })
    }
    
    console.log('📋 Session found:', {
      userId: session.user?.id,
      email: session.user?.email,
      name: session.user?.name
    })
    
    // Check if user exists in database
    let dbUser = null
    if (session.user?.email) {
      try {
        dbUser = await getUserByEmail(session.user.email)
        console.log('👤 Database user:', dbUser ? 'Found' : 'Not found')
      } catch (dbError) {
        console.error('Database error:', dbError)
      }
    }
    
    return NextResponse.json({
      success: true,
      authenticated: true,
      session: {
        userId: session.user?.id,
        email: session.user?.email,
        name: session.user?.name,
        company: session.user?.company
      },
      databaseUser: {
        exists: !!dbUser,
        id: dbUser?.id,
        email: dbUser?.email,
        active: dbUser?.isActive
      }
    })
    
  } catch (error) {
    console.error('🚨 Auth debug error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Authentication debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}