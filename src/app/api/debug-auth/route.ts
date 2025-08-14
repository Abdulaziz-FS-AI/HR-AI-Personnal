import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireUserContext } from '@/lib/security/user-context'
import { getUserEvaluations } from '@/lib/db-secure'

export async function GET(request: NextRequest) {
  const debugInfo: any = {
    step: '',
    error: null,
    session: null,
    userContext: null,
    evaluations: null,
    cookies: {},
    headers: {}
  }

  try {
    // Step 1: Check raw cookies
    debugInfo.step = 'Checking cookies'
    debugInfo.cookies = Object.fromEntries(request.cookies.entries())
    console.log('🍪 Cookies:', debugInfo.cookies)

    // Step 2: Check headers
    debugInfo.step = 'Checking headers'
    debugInfo.headers = Object.fromEntries(request.headers.entries())
    console.log('📡 Headers keys:', Object.keys(debugInfo.headers))

    // Step 3: Get NextAuth session
    debugInfo.step = 'Getting NextAuth session'
    const session = await auth()
    debugInfo.session = session ? {
      user: session.user,
      expires: session.expires
    } : null
    console.log('🔐 Session:', debugInfo.session)

    if (!session?.user?.id) {
      debugInfo.error = 'No session or user ID'
      return NextResponse.json(debugInfo)
    }

    // Step 4: Test requireUserContext
    debugInfo.step = 'Testing requireUserContext'
    try {
      const userContext = await requireUserContext(request)
      debugInfo.userContext = userContext
      console.log('👤 User context:', userContext)
    } catch (err) {
      debugInfo.error = `requireUserContext failed: ${err instanceof Error ? err.message : err}`
      return NextResponse.json(debugInfo)
    }

    // Step 5: Test getUserEvaluations
    debugInfo.step = 'Testing getUserEvaluations'
    try {
      const evaluations = await getUserEvaluations(session.user.id, {
        limit: 10,
        offset: 0
      })
      debugInfo.evaluations = {
        count: evaluations.length,
        sample: evaluations.slice(0, 2)
      }
      console.log('📊 Evaluations:', debugInfo.evaluations)
    } catch (err) {
      debugInfo.error = `getUserEvaluations failed: ${err instanceof Error ? err.message : err}`
      return NextResponse.json(debugInfo)
    }

    debugInfo.step = 'Success'
    return NextResponse.json(debugInfo)

  } catch (error) {
    debugInfo.error = error instanceof Error ? error.message : 'Unknown error'
    console.error('🚨 Debug auth error:', error)
    return NextResponse.json(debugInfo, { status: 500 })
  }
}