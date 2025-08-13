import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import sql from 'mssql'
import { getDbConnection } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let pool: sql.ConnectionPool | null = null
  
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      )
    }

    const evaluationId = params.id

    pool = await getDbConnection()
    
    // Get evaluation session
    const sessionResult = await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .input('userId', sql.NVarChar, session.user.id)
      .query(`
        SELECT 
          es.id,
          es.name,
          es.role_id as roleId,
          es.role_title as roleTitle,
          es.status,
          es.total_files as totalFiles,
          es.processed_files as processedFiles,
          es.failed_files as failedFiles,
          es.average_score as averageScore,
          es.top_candidates as topCandidates,
          es.created_at as createdAt,
          es.completed_at as completedAt
        FROM evaluation_sessions es
        WHERE es.id = @evaluationId AND es.user_id = @userId
      `)
    
    if (sessionResult.recordset.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Evaluation not found' },
        { status: 404 }
      )
    }

    // Get evaluation results
    const resultsResult = await pool.request()
      .input('sessionId', sql.UniqueIdentifier, evaluationId)
      .query(`
        SELECT 
          er.id,
          er.file_id as fileId,
          ef.file_name as fileName,
          COALESCE(er.candidate_name, 'Unknown') as candidateName,
          er.overall_score as overallScore,
          er.recommendations,
          er.red_flags as redFlags,
          er.ai_analysis as aiAnalysis
        FROM evaluation_results er
        JOIN evaluation_files ef ON er.file_id = ef.id
        WHERE er.session_id = @sessionId
        ORDER BY er.overall_score DESC
      `)
    
    // Parse JSON fields
    const results = resultsResult.recordset.map(row => {
      const aiAnalysis = row.aiAnalysis ? JSON.parse(row.aiAnalysis) : {}
      return {
        id: row.id,
        fileId: row.fileId,
        fileName: row.fileName,
        candidateName: row.candidateName,
        overallScore: row.overallScore,
        skillMatches: aiAnalysis.skillMatches || [],
        questionAnswers: aiAnalysis.questionAnswers || [],
        recommendations: row.recommendations || '',
        redFlags: JSON.parse(row.redFlags || '[]'),
        strengths: aiAnalysis.strengths || []
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        session: sessionResult.recordset[0],
        results
      }
    })

  } catch (error) {
    console.error('Error fetching evaluation:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch evaluation details',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  } finally {
    if (pool) {
      await pool.close()
    }
  }
}