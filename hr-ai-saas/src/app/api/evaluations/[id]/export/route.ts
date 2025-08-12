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

// GET /api/evaluations/[id]/export - Export evaluation results
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
    const format = searchParams.get('format') || 'csv'
    
    // Verify user owns this evaluation
    const evaluation = await getEvaluationSession(evaluationId, session.user.id)
    if (!evaluation) {
      return NextResponse.json(
        { error: 'Evaluation not found or access denied' },
        { status: 404 }
      )
    }
    
    // Get results and files
    const results = await getEvaluationResults(evaluationId)
    const files = await getEvaluationFiles(evaluationId)
    
    // Combine data
    const exportData = results.map(result => {
      const file = files.find(f => f.id === result.fileId)
      return {
        fileName: file?.fileName || 'Unknown',
        overallScore: file?.overallScore || 0,
        recommendation: result.recommendation,
        summary: result.summary,
        strengths: result.strengths.join('; '),
        weaknesses: result.weaknesses.join('; '),
        redFlags: result.redFlags.join('; '),
        suggestedQuestions: result.suggestedInterviewQuestions.join('; ')
      }
    })
    
    if (format === 'json') {
      // Export as JSON
      return new NextResponse(JSON.stringify({
        evaluation: {
          id: evaluation.id,
          name: evaluation.name,
          createdAt: evaluation.createdAt,
          completedAt: evaluation.completedAt
        },
        results: exportData
      }, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="evaluation-${evaluationId}.json"`
        }
      })
    } else {
      // Export as CSV
      const csvHeaders = [
        'File Name',
        'Overall Score',
        'Recommendation',
        'Summary',
        'Strengths',
        'Weaknesses',
        'Red Flags',
        'Suggested Interview Questions'
      ]
      
      const csvRows = exportData.map(row => [
        row.fileName,
        row.overallScore.toString(),
        `"${row.recommendation.replace(/"/g, '""')}"`,
        `"${row.summary.replace(/"/g, '""')}"`,
        `"${row.strengths.replace(/"/g, '""')}"`,
        `"${row.weaknesses.replace(/"/g, '""')}"`,
        `"${row.redFlags.replace(/"/g, '""')}"`,
        `"${row.suggestedQuestions.replace(/"/g, '""')}"`
      ])
      
      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.join(','))
      ].join('\n')
      
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="evaluation-${evaluationId}.csv"`
        }
      })
    }
  } catch (error) {
    console.error('Error exporting evaluation results:', error)
    return NextResponse.json(
      { error: 'Failed to export results' },
      { status: 500 }
    )
  }
}