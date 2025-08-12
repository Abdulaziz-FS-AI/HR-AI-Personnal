import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
  getEvaluationSession,
  updateEvaluationSession,
  getEvaluationFiles
} from '@/lib/db-evaluations'
import { BatchProcessor } from '@/lib/batch-processor'

interface RouteParams {
  params: {
    id: string
  }
}

// POST /api/evaluations/[id]/process - Start processing evaluation
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
    
    // Verify user owns this evaluation
    const evaluation = await getEvaluationSession(evaluationId, session.user.id)
    if (!evaluation) {
      return NextResponse.json(
        { error: 'Evaluation not found or access denied' },
        { status: 404 }
      )
    }
    
    // Check if evaluation is ready for processing
    if (evaluation.status === 'processing') {
      return NextResponse.json(
        { error: 'Evaluation is already being processed' },
        { status: 400 }
      )
    }
    
    if (evaluation.status === 'completed') {
      return NextResponse.json(
        { error: 'Evaluation has already been completed' },
        { status: 400 }
      )
    }
    
    // Get files for this evaluation
    const files = await getEvaluationFiles(evaluationId)
    
    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files to process' },
        { status: 400 }
      )
    }
    
    // Update evaluation status to processing
    await updateEvaluationSession(evaluationId, {
      status: 'processing',
      startedAt: new Date()
    })
    
    // Start batch processing
    try {
      const sessionId = await BatchProcessor.startBatchProcessing(
        evaluation.roleId,
        session.user.id
      )
      
      return NextResponse.json({
        success: true,
        message: 'Processing started',
        evaluationId,
        sessionId,
        filesCount: files.length
      })
    } catch (error) {
      // If processing fails to start, revert status
      await updateEvaluationSession(evaluationId, {
        status: 'ready'
      })
      
      throw error
    }
  } catch (error) {
    console.error('Error starting evaluation processing:', error)
    return NextResponse.json(
      { error: 'Failed to start processing' },
      { status: 500 }
    )
  }
}

// GET /api/evaluations/[id]/process - Get processing status
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
    
    // Get evaluation status
    const evaluation = await getEvaluationSession(evaluationId, session.user.id)
    if (!evaluation) {
      return NextResponse.json(
        { error: 'Evaluation not found or access denied' },
        { status: 404 }
      )
    }
    
    // Get files to calculate progress
    const files = await getEvaluationFiles(evaluationId)
    const processedCount = files.filter(f => 
      f.status === 'completed' || f.status === 'failed'
    ).length
    
    return NextResponse.json({
      success: true,
      status: evaluation.status,
      progress: {
        total: evaluation.totalFiles,
        processed: processedCount,
        failed: evaluation.failedFiles,
        percentage: evaluation.totalFiles > 0 
          ? Math.round((processedCount / evaluation.totalFiles) * 100)
          : 0
      },
      startedAt: evaluation.startedAt,
      completedAt: evaluation.completedAt
    })
  } catch (error) {
    console.error('Error getting processing status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}