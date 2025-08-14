import sql from 'mssql'
import { executeQuery } from './db-utils'

/**
 * Production-ready database configuration
 * Uses lazy initialization to avoid build-time errors
 */

// Global connection pool for serverless optimization
let globalPool: sql.ConnectionPool | null = null
let poolPromise: Promise<sql.ConnectionPool> | null = null
let configCache: sql.config | null = null

/**
 * Get database configuration (lazy-loaded)
 */
function getDatabaseConfig(): sql.config {
  if (!configCache) {
    // Check environment variables at runtime
    if (!process.env.AZURE_SQL_SERVER || 
        !process.env.AZURE_SQL_DATABASE || 
        !process.env.AZURE_SQL_USER || 
        !process.env.AZURE_SQL_PASSWORD) {
      throw new Error(
        'Database configuration missing. Please set AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, and AZURE_SQL_PASSWORD environment variables.'
      )
    }

    configCache = {
      server: process.env.AZURE_SQL_SERVER,
      database: process.env.AZURE_SQL_DATABASE,
      user: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD,
      pool: {
        max: 5,
        min: 1,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
      },
      options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true,
      },
      connectionTimeout: 30000,
      requestTimeout: 30000,
      cancelTimeout: 5000,
    }
  }
  return configCache
}

/**
 * Create a new connection pool
 */
async function createPool(): Promise<sql.ConnectionPool> {
  const config = getDatabaseConfig()
  const pool = new sql.ConnectionPool(config)
  await pool.connect()
  console.log('✅ Database connection pool created successfully')
  return pool
}

/**
 * Get database connection with proper pooling
 */
export async function getDbConnection(): Promise<sql.ConnectionPool> {
  try {
    // Return existing pool if available and connected
    if (globalPool && globalPool.connected) {
      return globalPool
    }

    // If pool creation is in progress, wait for it
    if (poolPromise) {
      return await poolPromise
    }

    // Create new pool
    poolPromise = createPool()
    globalPool = await poolPromise
    poolPromise = null

    return globalPool
  } catch (error) {
    poolPromise = null
    globalPool = null
    console.error('Database connection failed:', error)
    throw new Error(`Failed to connect to Azure SQL Database: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Close the database connection pool
 */
export async function closeDbConnection(): Promise<void> {
  if (globalPool) {
    try {
      await globalPool.close()
      globalPool = null
      poolPromise = null
      console.log('Database connection pool closed')
    } catch (error) {
      console.error('Error closing database pool:', error)
    }
  }
}

/**
 * Check if database is configured (without throwing)
 */
export function isDatabaseConfigured(): boolean {
  return !!(
    process.env.AZURE_SQL_SERVER &&
    process.env.AZURE_SQL_DATABASE &&
    process.env.AZURE_SQL_USER &&
    process.env.AZURE_SQL_PASSWORD
  )
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    return false
  }

  try {
    const result = await executeQuery('SELECT 1 as health')
    return result.recordset.length > 0
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}

// Export the config getter for other modules that need it
export function getServerConfig() {
  try {
    return getDatabaseConfig()
  } catch {
    return null
  }
}