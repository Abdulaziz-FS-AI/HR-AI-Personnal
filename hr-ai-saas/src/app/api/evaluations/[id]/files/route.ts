import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
  addFilesToEvaluation,
  getEvaluationFiles,
  updateEvaluationFile,
  getEvaluationSession,
  updateEvaluationSession
} from '@/lib/db-evaluations'

interface RouteParams {
  params: {
    id: string
  }
}

// POST /api/evaluations/[id]/files - Add files to evaluation
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const evaluationId = params.id
    const body = await req.json()
    const { files } = body
    
    if (!files || !Array.isArray(files)) {
      return NextResponse.json(
        { error: 'Files array is required' },
        { status: 400 }
      )
    }
    
    // Verify user owns this evaluation
    const evaluation = await getEvaluationSession(evaluationId, session.user.id)
    if (!evaluation) {
      return NextResponse.json(
        { error: 'Evaluation not found or access denied' },
        { status: 404 }
      )
    }
    
    // Add files to evaluation
    const success = await addFilesToEvaluation(evaluationId, files)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to add files to evaluation' },
        { status: 500 }
      )
    }
    
    // Update evaluation status to 'ready' if it was 'draft'
    if (evaluation.status === 'draft') {
      await updateEvaluationSession(evaluationId, { status: 'ready' })
    }
    
    return NextResponse.json({
      success: true,
      message: `${files.length} files added to evaluation`,
      evaluationId
    })
  } catch (error) {
    console.error('Error adding files to evaluation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/evaluations/[id]/files - Get evaluation files
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const evaluationId = params.id
    
    // Verify user owns this evaluation
    const evaluation = await getEvaluationSession(evaluationId, session.user.id)
    if (!evaluation) {
      return NextResponse.json(
        { error: 'Evaluation not found or access denied' },
        { status: 404 }
      )
    }
    
    // Get files for this evaluation
    const files = await getEvaluationFiles(evaluationId)
    
    return NextResponse.json({
      success: true,
      files,
      summary: {
        total: files.length,
        pending: files.filter(f => f.status === 'pending').length,
        processing: files.filter(f => f.status === 'processing').length,
        completed: files.filter(f => f.status === 'completed').length,
        failed: files.filter(f => f.status === 'failed').length
      }
    })
  } catch (error) {
    console.error('Error fetching evaluation files:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/evaluations/[id]/files - Update file status
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const evaluationId = params.id
    const body = await req.json()
    const { fileId, status, extractedText, overallScore, recommendation } = body
    
    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId is required' },
        { status: 400 }
      )
    }
    
    // Verify user owns this evaluation
    const evaluation = await getEvaluationSession(evaluationId, session.user.id)
    if (!evaluation) {
      return NextResponse.json(
        { error: 'Evaluation not found or access denied' },
        { status: 404 }
      )
    }
    
    // Update file
    const updates: any = {}
    if (status) updates.status = status
    if (extractedText !== undefined) updates.extractedText = extractedText
    if (overallScore !== undefined) updates.overallScore = overallScore
    if (recommendation !== undefined) updates.recommendation = recommendation
    if (status === 'processing' || status === 'completed') {
      updates.processedAt = new Date()
    }
    
    const success = await updateEvaluationFile(fileId, updates)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update file' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'File updated successfully',
      fileId
    })
  } catch (error) {
    console.error('Error updating evaluation file:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}