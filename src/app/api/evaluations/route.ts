import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createEvaluationSession, getEvaluationSessions } from '@/lib/db-evaluations'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const roleId = searchParams.get('roleId') || undefined
    const status = searchParams.get('status') || undefined

    const evaluations = await getEvaluationSessions(
      session.user.id,
      { limit, offset, roleId, status }
    )

    return NextResponse.json({
      success: true,
      data: evaluations.data,
      pagination: {
        limit,
        offset,
        total: evaluations.total,
        hasMore: offset + limit < evaluations.total
      }
    })
  } catch (error) {
    console.error('Get evaluations error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch evaluations' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, roleId } = body

    if (!name || !roleId) {
      return NextResponse.json(
        { error: 'Name and roleId are required' },
        { status: 400 }
      )
    }

    const evaluation = await createEvaluationSession({
      userId: session.user.id,
      roleId,
      name
    })

    return NextResponse.json({
      success: true,
      data: evaluation
    })
  } catch (error) {
    console.error('Create evaluation error:', error)
    return NextResponse.json(
      { error: 'Failed to create evaluation' },
      { status: 500 }
    )
  }
}