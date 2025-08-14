import { getDbConnection } from '@/lib/db'
import sql from 'mssql'

interface ValidationResult {
  isReady: boolean
  missingComponents: string[]
  recommendations: string[]
  canAutoFix: boolean
}

export class EvaluationSystemValidator {
  
  /**
   * Validate if evaluation system is ready for use
   */
  static async validateSystem(): Promise<ValidationResult> {
    let pool: sql.ConnectionPool | null = null
    
    try {
      pool = await getDbConnection()
      
      const result: ValidationResult = {
        isReady: false,
        missingComponents: [],
        recommendations: [],
        canAutoFix: true
      }

      // Check required tables
      const requiredTables = [
        'users',
        'roles', 
        'role_skills',
        'role_questions',
        'evaluation_sessions',
        'evaluation_files',
        'evaluation_results'
      ]

      const existingTables = await pool.request().query(`
        SELECT name FROM sysobjects 
        WHERE name IN (${requiredTables.map(t => `'${t}'`).join(',')}) AND xtype='U'
      `)

      const existingTableNames = existingTables.recordset.map(r => r.name)
      const missingTables = requiredTables.filter(t => !existingTableNames.includes(t))

      if (missingTables.length > 0) {
        result.missingComponents.push(...missingTables.map(t => `Table: ${t}`))
        
        // Specific recommendations based on missing tables
        const baseTables = ['users', 'roles', 'role_skills', 'role_questions']
        const evaluationTables = ['evaluation_sessions', 'evaluation_files', 'evaluation_results']
        
        const missingBaseTables = baseTables.filter(t => missingTables.includes(t))
        const missingEvalTables = evaluationTables.filter(t => missingTables.includes(t))

        if (missingBaseTables.length > 0) {
          result.recommendations.push('Deploy base schema: POST /api/deploy-basic-schema')
        }
        
        if (missingEvalTables.length > 0) {
          result.recommendations.push('Deploy evaluation system: POST /api/deploy-evaluation-system')
        }
      }

      // Check for proper constraints
      if (existingTableNames.includes('evaluation_sessions')) {
        const constraintCheck = await pool.request().query(`
          SELECT name FROM sys.check_constraints 
          WHERE parent_object_id = OBJECT_ID('evaluation_sessions')
        `)
        
        if (constraintCheck.recordset.length === 0) {
          result.missingComponents.push('Status constraints on evaluation_sessions')
          result.recommendations.push('Fix constraints: POST /api/deploy-evaluation-system')
        }
      }

      // Check for foreign key relationships
      if (existingTableNames.includes('evaluation_files') && existingTableNames.includes('evaluation_sessions')) {
        const fkCheck = await pool.request().query(`
          SELECT name FROM sys.foreign_keys 
          WHERE name = 'FK_evaluation_files_sessions'
        `)
        
        if (fkCheck.recordset.length === 0) {
          result.missingComponents.push('Foreign key relationships')
          result.recommendations.push('Add relationships: POST /api/deploy-evaluation-system')
        }
      }

      result.isReady = result.missingComponents.length === 0

      await pool.close()
      return result

    } catch (error) {
      console.error('System validation error:', error)
      
      if (pool) {
        await pool.close()
      }

      return {
        isReady: false,
        missingComponents: ['Database connection'],
        recommendations: ['Check database configuration and connectivity'],
        canAutoFix: false
      }
    }
  }

  /**
   * Get user-friendly error message for missing system components
   */
  static getErrorMessage(validation: ValidationResult): string {
    if (validation.isReady) {
      return ''
    }

    const missing = validation.missingComponents.join(', ')
    const actions = validation.recommendations.join(' → ')

    return `Evaluation system not ready. Missing: ${missing}. Actions needed: ${actions}`
  }

  /**
   * Check if a specific table exists
   */
  static async tableExists(tableName: string): Promise<boolean> {
    let pool: sql.ConnectionPool | null = null
    
    try {
      pool = await getDbConnection()
      
      const result = await pool.request().query(`
        SELECT name FROM sysobjects 
        WHERE name='${tableName}' AND xtype='U'
      `)

      await pool.close()
      return result.recordset.length > 0

    } catch (error) {
      if (pool) await pool.close()
      return false
    }
  }

  /**
   * Get system readiness status for health checks
   */
  static async getSystemStatus() {
    const validation = await this.validateSystem()
    
    return {
      status: validation.isReady ? 'ready' : 'not_ready',
      readiness_percentage: Math.round(((7 - validation.missingComponents.length) / 7) * 100),
      missing_count: validation.missingComponents.length,
      can_auto_fix: validation.canAutoFix,
      next_steps: validation.recommendations
    }
  }
}