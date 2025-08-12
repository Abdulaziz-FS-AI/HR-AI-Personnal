import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
  createEvaluationSession, 
  getUserEvaluationSessions,
  getEvaluationSession 
} from '@/lib/db-evaluations'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const body = await req.json()
    const { name, description, roleId } = body
    
    if (!name || !roleId) {
      return NextResponse.json(
        { error: 'Name and roleId are required' },
        { status: 400 }
      )
    }
    
    // Create evaluation session
    const evaluation = await createEvaluationSession({
      userId: session.user.id,
      roleId,
      name,
      description
    })
    
    if (!evaluation) {
      return NextResponse.json(
        { error: 'Failed to create evaluation' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      evaluation
    })
  } catch (error) {
    console.error('Error creating evaluation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get specific evaluation or all user's evaluations
    const { searchParams } = new URL(req.url)
    const evaluationId = searchParams.get('id')
    
    if (evaluationId) {
      const evaluation = await getEvaluationSession(evaluationId, session.user.id)
      
      if (!evaluation) {
        return NextResponse.json(
          { error: 'Evaluation not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json({
        success: true,
        evaluation
      })
    } else {
      const evaluations = await getUserEvaluationSessions(session.user.id)
      
      return NextResponse.json({
        success: true,
        evaluations
      })
    }
  } catch (error) {
    console.error('Error fetching evaluations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}