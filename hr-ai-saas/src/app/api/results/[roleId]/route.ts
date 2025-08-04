import { NextRequest, NextResponse } from 'next/server'
import { getAnalysisResultsByRole } from '@/lib/db-results'
import { auth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roleId } = await params
    const { searchParams } = new URL(request.url)
    
    const userId = searchParams.get('userId') || session.user.id
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get analysis results
    const results = await getAnalysisResultsByRole(roleId, userId, limit, offset)

    return NextResponse.json({
      success: true,
      results,
      pagination: {
        limit,
        offset,
        total: results.length
      }
    })

  } catch (error) {
    console.error('Error fetching results:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}