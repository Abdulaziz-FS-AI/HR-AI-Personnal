import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
  getEvaluationSession,
  getEvaluationResults,
  getEvaluationFiles
} from '@/lib/db-evaluations'

interface RouteParams {
  params: {
    id: string
  }
}

// GET /api/evaluations/[id]/results - Get evaluation results
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
    const { searchParams } = new URL(req.url)
    
    // Optional filters
    const scoreMin = searchParams.get('scoreMin')
    const scoreMax = searchParams.get('scoreMax')
    const sortBy = searchParams.get('sortBy') || 'score'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    
    // Verify user owns this evaluation
    const evaluation = await getEvaluationSession(evaluationId, session.user.id)
    if (!evaluation) {
      return NextResponse.json(
        { error: 'Evaluation not found or access denied' },
        { status: 404 }
      )
    }
    
    // Get results
    let results = await getEvaluationResults(evaluationId)
    
    // Get files for additional info
    const files = await getEvaluationFiles(evaluationId)
    
    // Combine results with file info
    const combinedResults = results.map(result => {
      const file = files.find(f => f.id === result.fileId)
      return {
        ...result,
        fileName: file?.fileName || 'Unknown',
        fileStatus: file?.status || 'unknown',
        overallScore: file?.overallScore || 0,
        candidateInfo: file?.candidateInfo
      }
    })
    
    // Apply filters
    let filteredResults = combinedResults
    
    if (scoreMin) {
      filteredResults = filteredResults.filter(r => r.overallScore >= parseFloat(scoreMin))
    }
    
    if (scoreMax) {
      filteredResults = filteredResults.filter(r => r.overallScore <= parseFloat(scoreMax))
    }
    
    // Apply sorting
    filteredResults.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'score':
          comparison = (a.overallScore || 0) - (b.overallScore || 0)
          break
        case 'name':
          comparison = (a.fileName || '').localeCompare(b.fileName || '')
          break
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        default:
          comparison = (a.overallScore || 0) - (b.overallScore || 0)
      }
      
      return sortOrder === 'desc' ? -comparison : comparison
    })
    
    // Calculate statistics
    const scores = filteredResults.map(r => r.overallScore || 0).filter(s => s > 0)
    const stats = {
      total: filteredResults.length,
      averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      highScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowScore: scores.length > 0 ? Math.min(...scores) : 0,
      excellent: filteredResults.filter(r => (r.overallScore || 0) >= 80).length,
      good: filteredResults.filter(r => (r.overallScore || 0) >= 60 && (r.overallScore || 0) < 80).length,
      fair: filteredResults.filter(r => (r.overallScore || 0) >= 40 && (r.overallScore || 0) < 60).length,
      poor: filteredResults.filter(r => (r.overallScore || 0) < 40 && (r.overallScore || 0) > 0).length
    }
    
    return NextResponse.json({
      success: true,
      evaluation: {
        id: evaluation.id,
        name: evaluation.name,
        status: evaluation.status,
        totalFiles: evaluation.totalFiles,
        processedFiles: evaluation.processedFiles
      },
      results: filteredResults,
      stats
    })
  } catch (error) {
    console.error('Error fetching evaluation results:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}