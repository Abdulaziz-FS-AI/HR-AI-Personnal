import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { executeQuery } from '@/lib/db-utils'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const evaluations = await executeQuery(async (pool) => {
      const result = await pool.request()
        .input('userId', session.user.id)
        .query(`
          SELECT 
            bs.id,
            bs.session_name as name,
            r.title as roleTitle,
            bs.status,
            bs.created_at as createdAt,
            bs.updated_at as completedAt,
            bs.total_files as totalResumes,
            bs.processed_files as processedResumes,
            COALESCE(
              (SELECT AVG(overall_score) 
               FROM resume_analysis_results 
               WHERE batch_session_id = bs.id), 
              0
            ) as averageScore,
            COALESCE(
              (SELECT COUNT(*) 
               FROM resume_analysis_results 
               WHERE batch_session_id = bs.id 
               AND overall_score >= 80), 
              0
            ) as topCandidates
          FROM batch_sessions bs
          LEFT JOIN roles r ON bs.role_id = r.id
          WHERE bs.user_id = @userId
          ORDER BY bs.created_at DESC
        `)
      
      return result.recordset.map(session => ({
        ...session,
        averageScore: Math.round(session.averageScore || 0),
        status: mapStatus(session.status)
      }))
    })

    return NextResponse.json({ evaluations: evaluations || [] })
  } catch (error) {
    console.error('Evaluations fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch evaluations', evaluations: [] },
      { status: 500 }
    )
  }
}

function mapStatus(dbStatus: string): 'running' | 'completed' | 'failed' | 'pending' {
  switch (dbStatus?.toLowerCase()) {
    case 'processing':
      return 'running'
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'pending':
    case 'created':
      return 'pending'
    default:
      return 'pending'
  }
}