import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserByEmail, getRolesByUserId } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 DEBUG: Session analysis...')
    
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({
        success: false,
        message: 'No session found - user not authenticated',
        step: 'session_check'
      })
    }
    
    console.log('📋 Session data:', {
      userId: session.user?.id,
      email: session.user?.email,
      name: session.user?.name
    })
    
    // Check user in database
    let dbUser = null
    let userRoles = []
    
    if (session.user?.email) {
      try {
        dbUser = await getUserByEmail(session.user.email)
        console.log('👤 Database user found:', !!dbUser)
        
        if (dbUser && session.user.id) {
          userRoles = await getRolesByUserId(session.user.id)
          console.log('💼 User roles count:', userRoles.length)
        }
      } catch (dbError) {
        console.error('Database error:', dbError)
        return NextResponse.json({
          success: false,
          error: 'Database query failed',
          details: dbError instanceof Error ? dbError.message : 'Unknown error',
          step: 'database_query'
        })
      }
    }
    
    // UUID validation check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const validUUID = session.user?.id ? uuidRegex.test(session.user.id) : false
    
    return NextResponse.json({
      success: true,
      step: 'complete_analysis',
      session: {
        authenticated: true,
        userId: session.user?.id,
        email: session.user?.email,
        name: session.user?.name,
        validUUID: validUUID
      },
      database: {
        userExists: !!dbUser,
        userId: dbUser?.id,
        userActive: dbUser?.isActive,
        roleCount: userRoles.length,
        roles: userRoles.map(r => ({ id: r.id, title: r.title }))
      },
      diagnosis: {
        sessionValid: !!session,
        userInDatabase: !!dbUser,
        hasValidUUID: validUUID,
        hasRoles: userRoles.length > 0,
        canAccessDashboard: !!session && !!dbUser && validUUID
      }
    })
    
  } catch (error) {
    console.error('🚨 Session debug error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Session analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      step: 'error'
    }, { status: 500 })
  }
}