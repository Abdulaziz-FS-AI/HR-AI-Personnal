import { NextRequest, NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'
import sql from 'mssql'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let pool: sql.ConnectionPool | null = null
  
  try {
    const evaluationId = params.id
    pool = await getDbConnection()
    
    // Get evaluation results
    const resultsQuery = await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query(`
        SELECT 
          ef.file_name,
          ef.overall_score,
          ef.candidate_info,
          er.skills_analysis,
          er.recommendation,
          er.red_flags,
          er.strengths
        FROM evaluation_results er
        JOIN evaluation_files ef ON er.file_id = ef.id
        WHERE er.evaluation_id = @evaluationId
        ORDER BY ef.overall_score DESC
      `)
    
    // Create CSV content
    const csvRows = ['Candidate Name,Score,Skills Matched,Recommendation']
    
    for (const row of resultsQuery.recordset) {
      let candidateName = 'Unknown'
      try {
        const candidateInfo = JSON.parse(row.candidate_info || '{}')
        candidateName = candidateInfo.name || row.file_name?.replace('.pdf', '') || 'Unknown'
      } catch {}
      
      let skillsMatched = 0
      try {
        const skills = JSON.parse(row.skills_analysis || '[]')
        skillsMatched = skills.filter((s: any) => s.found).length
      } catch {}
      
      const csvRow = [
        candidateName,
        Math.round(row.overall_score || 0),
        skillsMatched,
        (row.recommendation || '').replace(/,/g, ';').substring(0, 100)
      ].join(',')
      
      csvRows.push(csvRow)
    }
    
    const csvContent = csvRows.join('\n')
    
    // Return as CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="evaluation-${evaluationId}.csv"`
      }
    })
    
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to export results',
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