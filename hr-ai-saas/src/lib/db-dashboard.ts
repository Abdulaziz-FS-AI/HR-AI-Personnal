import { executeQuery } from './db-utils'

export interface DashboardStats {
  creditsRemaining: number
  totalEvaluations: number
  resumesProcessed: number
  rolesCreated: number
  completedSteps: {
    accountCreated: boolean
    firstRoleCreated: boolean
    firstAnalysisCompleted: boolean
  }
}

export async function getUserDashboardStats(userId: string): Promise<DashboardStats | null> {
  return executeQuery(async (pool) => {
    // Get user credits
    const userResult = await pool.request()
      .input('userId', userId)
      .query(`
        SELECT credits_remaining 
        FROM users 
        WHERE id = @userId
      `)
    
    const creditsRemaining = userResult.recordset[0]?.credits_remaining || 0
    
    // Get total evaluations count
    const evaluationsResult = await pool.request()
      .input('userId', userId)
      .query(`
        SELECT COUNT(DISTINCT batch_session_id) as total_evaluations
        FROM resume_analysis_results
        WHERE user_id = @userId
      `)
    
    const totalEvaluations = evaluationsResult.recordset[0]?.total_evaluations || 0
    
    // Get resumes processed count
    const resumesResult = await pool.request()
      .input('userId', userId)
      .query(`
        SELECT COUNT(*) as resumes_processed
        FROM uploaded_files
        WHERE user_id = @userId
        AND processing_status = 'completed'
      `)
    
    const resumesProcessed = resumesResult.recordset[0]?.resumes_processed || 0
    
    // Get roles created count
    const rolesResult = await pool.request()
      .input('userId', userId)
      .query(`
        SELECT COUNT(*) as roles_created
        FROM roles
        WHERE created_by = @userId
      `)
    
    const rolesCreated = rolesResult.recordset[0]?.roles_created || 0
    
    return {
      creditsRemaining,
      totalEvaluations,
      resumesProcessed,
      rolesCreated,
      completedSteps: {
        accountCreated: true, // Always true if they're logged in
        firstRoleCreated: rolesCreated > 0,
        firstAnalysisCompleted: totalEvaluations > 0
      }
    }
  })
}