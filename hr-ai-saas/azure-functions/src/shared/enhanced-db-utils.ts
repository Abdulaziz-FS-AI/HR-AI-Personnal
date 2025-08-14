import sql from 'mssql'
import { validateUUID, ValidationError } from './validation-utils'

interface DatabaseConfig {
  server: string
  database: string
  user: string
  password: string
  pool: {
    max: number
    min: number
    idleTimeoutMillis: number
    acquireTimeoutMillis: number
  }
  options: {
    encrypt: boolean
    trustServerCertificate: boolean
    requestTimeout: number
    connectionTimeout: number
  }
  retryOptions: {
    maxRetries: number
    retryDelayMs: number
  }
}

class DatabaseManager {
  private pools: Map<string, sql.ConnectionPool> = new Map()
  private config: DatabaseConfig
  private healthCheckInterval: NodeJS.Timeout | null = null

  constructor() {
    this.config = {
      server: process.env.DB_SERVER || '',
      database: process.env.DB_DATABASE || '',
      user: process.env.DB_USERNAME || '',
      password: process.env.DB_PASSWORD || '',
      pool: {
        max: 20,
        min: 2,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 60000
      },
      options: {
        encrypt: true,
        trustServerCertificate: false,
        requestTimeout: 30000,
        connectionTimeout: 15000
      },
      retryOptions: {
        maxRetries: 3,
        retryDelayMs: 1000
      }
    }

    this.startHealthCheck()
  }

  /**
   * Get healthy database connection with retry logic
   */
  async getHealthyConnection(): Promise<sql.ConnectionPool> {
    const poolKey = 'default'
    let pool = this.pools.get(poolKey)

    for (let attempt = 0; attempt <= this.config.retryOptions.maxRetries; attempt++) {
      try {
        if (!pool || !pool.connected) {
          pool = await this.createPool()
          this.pools.set(poolKey, pool)
        }

        // Health check
        await pool.request().query('SELECT 1 as healthy')
        return pool

      } catch (error) {
        console.error(`Database connection attempt ${attempt + 1} failed:`, error)
        
        if (pool) {
          try {
            await pool.close()
          } catch (closeError) {
            console.error('Error closing unhealthy pool:', closeError)
          }
          this.pools.delete(poolKey)
          pool = null
        }

        if (attempt < this.config.retryOptions.maxRetries) {
          await this.delay(this.config.retryOptions.retryDelayMs * Math.pow(2, attempt))
        } else {
          throw new Error(`Database connection failed after ${this.config.retryOptions.maxRetries + 1} attempts`)
        }
      }
    }

    throw new Error('Unable to establish database connection')
  }

  /**
   * Execute query with transaction support and retry logic
   */
  async executeTransaction<T>(
    operations: (transaction: sql.Transaction) => Promise<T>
  ): Promise<T> {
    const pool = await this.getHealthyConnection()
    const transaction = new sql.Transaction(pool)

    try {
      await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED)
      const result = await operations(transaction)
      await transaction.commit()
      return result
    } catch (error) {
      console.error('Transaction failed, rolling back:', error)
      try {
        await transaction.rollback()
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError)
      }
      throw error
    }
  }

  /**
   * Execute query with parameter validation and sanitization
   */
  async executeQuery<T = any>(
    query: string,
    params: Record<string, any> = {},
    options: { timeout?: number } = {}
  ): Promise<T[]> {
    const pool = await this.getHealthyConnection()
    const request = pool.request()

    // Set timeout
    if (options.timeout) {
      request.timeout = options.timeout
    }

    // Add and validate parameters
    Object.entries(params).forEach(([key, value]) => {
      this.validateParameter(key, value)
      request.input(key, value)
    })

    try {
      const result = await request.query(query)
      return result.recordset || []
    } catch (error) {
      console.error('Query execution failed:', {
        query: query.substring(0, 200), // Log first 200 chars of query
        params: Object.keys(params),
        error: error instanceof Error ? error.message : error
      })
      throw error
    }
  }

  /**
   * Batch operations for better performance
   */
  async executeBatch<T>(
    operations: Array<{
      query: string
      params: Record<string, any>
    }>,
    batchSize: number = 10
  ): Promise<T[][]> {
    const results: T[][] = []
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize)
      const batchPromises = batch.map(op => 
        this.executeQuery<T>(op.query, op.params)
      )
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }

    return results
  }

  /**
   * Safe file status update with validation
   */
  async updateFileStatus(
    fileId: string,
    status: 'uploaded' | 'processing' | 'analyzing' | 'analyzed' | 'failed',
    extractedText?: string,
    errorMessage?: string
  ): Promise<void> {
    validateUUID(fileId, 'fileId')
    
    const validStatuses = ['uploaded', 'processing', 'analyzing', 'analyzed', 'failed']
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid status: ${status}`)
    }

    await this.executeQuery(
      `UPDATE uploaded_files 
       SET processingStatus = @status, 
           extractedText = @extractedText,
           errorMessage = @errorMessage,
           processedDate = GETDATE()
       WHERE id = @fileId`,
      {
        fileId,
        status,
        extractedText: extractedText || null,
        errorMessage: errorMessage || null
      }
    )
  }

  /**
   * Atomic analysis result save
   */
  async saveAnalysisResults(
    fileId: string,
    roleId: string,
    sessionId: string,
    analysis: any
  ): Promise<void> {
    validateUUID(fileId, 'fileId')
    validateUUID(roleId, 'roleId')
    validateUUID(sessionId, 'sessionId')

    await this.executeTransaction(async (transaction) => {
      const request = new sql.Request(transaction)
      
      // Generate analysis ID
      const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Insert main analysis result
      await request.query(`
        INSERT INTO resume_analysis_results (
          id, fileId, roleId, sessionId, overallScore, technicalScore, 
          experienceScore, educationScore, skillsScore, cultureFitScore,
          executiveSummary, detailedAnalysis, topStrengths, concernsGaps,
          redFlags, standoutAchievements, interviewQuestions, recommendation,
          recommendationReason, aiModelUsed, processingTimeSeconds, aiCost,
          createdDate
        ) VALUES (
          @analysisId, @fileId, @roleId, @sessionId, @overallScore, @technicalScore,
          @experienceScore, @educationScore, @skillsScore, @cultureFitScore,
          @executiveSummary, @detailedAnalysis, @topStrengths, @concernsGaps,
          @redFlags, @standoutAchievements, @interviewQuestions, @recommendation,
          @recommendationReason, @aiModelUsed, @processingTimeSeconds, @aiCost,
          GETDATE()
        )`, {
        analysisId,
        fileId,
        roleId,
        sessionId,
        overallScore: analysis.overallScore,
        technicalScore: analysis.technicalScore,
        experienceScore: analysis.experienceScore,
        educationScore: analysis.educationScore,
        skillsScore: analysis.skillsScore,
        cultureFitScore: analysis.cultureFitScore,
        executiveSummary: analysis.executiveSummary,
        detailedAnalysis: analysis.detailedAnalysis,
        topStrengths: JSON.stringify(analysis.topStrengths || []),
        concernsGaps: JSON.stringify(analysis.concernsGaps || []),
        redFlags: JSON.stringify(analysis.redFlags || []),
        standoutAchievements: JSON.stringify(analysis.standoutAchievements || []),
        interviewQuestions: JSON.stringify(analysis.interviewQuestions || []),
        recommendation: analysis.recommendation,
        recommendationReason: analysis.recommendationReason,
        aiModelUsed: analysis.aiModelUsed,
        processingTimeSeconds: analysis.processingTimeSeconds,
        aiCost: analysis.aiCost
      })

      // Update file status
      await request.query(`
        UPDATE uploaded_files 
        SET processingStatus = 'analyzed', processedDate = GETDATE()
        WHERE id = @fileId
      `, { fileId })

      return analysisId
    })
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const startTime = Date.now()
    
    try {
      const pool = await this.getHealthyConnection()
      await pool.request().query('SELECT 1 as test, GETDATE() as timestamp')
      
      return {
        healthy: true,
        latency: Date.now() - startTime
      }
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async createPool(): Promise<sql.ConnectionPool> {
    const pool = new sql.ConnectionPool(this.config)
    
    pool.on('error', (error) => {
      console.error('Database pool error:', error)
    })

    await pool.connect()
    return pool
  }

  private validateParameter(key: string, value: any): void {
    if (key.includes(';') || key.includes('--') || key.includes('/*')) {
      throw new ValidationError(`Invalid parameter name: ${key}`)
    }

    if (typeof value === 'string' && value.length > 100000) { // 100KB limit
      throw new ValidationError(`Parameter ${key} too large`)
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck()
      } catch (error) {
        console.error('Health check failed:', error)
      }
    }, 60000) // Check every minute
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    for (const pool of this.pools.values()) {
      try {
        await pool.close()
      } catch (error) {
        console.error('Error closing pool:', error)
      }
    }

    this.pools.clear()
  }
}

// Singleton instance
let dbManager: DatabaseManager | null = null

export function getDbManager(): DatabaseManager {
  if (!dbManager) {
    dbManager = new DatabaseManager()
  }
  return dbManager
}

// Backward compatibility exports
export const getDbPool = () => getDbManager().getHealthyConnection()
export const executeQuery = <T = any>(query: string, params?: Record<string, any>) => 
  getDbManager().executeQuery<T>(query, params)
export const updateFileStatus = (fileId: string, status: any, extractedText?: string, errorMessage?: string) =>
  getDbManager().updateFileStatus(fileId, status, extractedText, errorMessage)
export const saveAnalysisResults = (fileId: string, roleId: string, sessionId: string, analysis: any) =>
  getDbManager().saveAnalysisResults(fileId, roleId, sessionId, analysis)