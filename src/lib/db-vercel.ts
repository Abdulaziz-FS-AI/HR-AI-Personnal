import sql from 'mssql'
import { getDatabaseConfig, validateDatabaseConfig } from './db-config-vercel'

// Vercel-optimized database connection for serverless environment
// Uses singleton pattern with connection pooling optimized for serverless

let globalPool: sql.ConnectionPool | undefined

// Connection configuration for Vercel serverless
const getConfig = (): sql.config => {
  console.log('🔧 Getting database config for Vercel...')
  
  // Use the new configuration helper that checks multiple naming conventions
  const dbConfig = validateDatabaseConfig()
  
  console.log('Database configuration loaded:', {
    hasServer: !!dbConfig.server,
    hasDatabase: !!dbConfig.database,
    hasUser: !!dbConfig.user,
    hasPassword: !!dbConfig.password,
    isVercel: !!process.env.VERCEL,
    nodeEnv: process.env.NODE_ENV
  })

  return {
    server: dbConfig.server,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true
    },
    pool: {
      max: 3, // Very small pool for serverless
      min: 0,
      idleTimeoutMillis: 5000, // 5 seconds
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    },
    requestTimeout: 30000,
    connectionTimeout: 30000
  }
}

// Get or create connection pool
export async function getVercelDbConnection(): Promise<sql.ConnectionPool> {
  try {
    // If we have a connected pool, return it
    if (globalPool && globalPool.connected) {
      console.log('♻️ Reusing existing database connection')
      return globalPool
    }

    // If pool exists but not connected, close it
    if (globalPool) {
      console.log('🔄 Closing stale connection pool')
      try {
        await globalPool.close()
      } catch (e) {
        console.warn('Warning: Error closing stale pool:', e)
      }
      globalPool = undefined
    }

    // Create new connection
    console.log('🔌 Creating new database connection for Vercel...')
    const config = getConfig()
    const pool = new sql.ConnectionPool(config)
    
    // Connect with error handling
    await pool.connect()
    
    console.log('✅ Database connected successfully')
    globalPool = pool
    
    // Set up error handler
    pool.on('error', (err) => {
      console.error('🚨 Database pool error:', err)
      globalPool = undefined
    })

    return pool
  } catch (error) {
    console.error('❌ Failed to connect to database:', error)
    globalPool = undefined
    throw error
  }
}

// Execute query with automatic connection management
export async function executeVercelQuery<T = any>(
  queryText: string,
  parameters?: Record<string, any>
): Promise<sql.IResult<T>> {
  let pool: sql.ConnectionPool | undefined
  
  try {
    pool = await getVercelDbConnection()
    const request = pool.request()

    // Add parameters if provided
    if (parameters) {
      Object.entries(parameters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (typeof value === 'string') {
            request.input(key, sql.NVarChar, value)
          } else if (typeof value === 'number') {
            request.input(key, Number.isInteger(value) ? sql.Int : sql.Float, value)
          } else if (typeof value === 'boolean') {
            request.input(key, sql.Bit, value)
          } else if (value instanceof Date) {
            request.input(key, sql.DateTime2, value)
          } else {
            request.input(key, value)
          }
        }
      })
    }

    console.log('🔍 Executing query:', queryText.substring(0, 100) + '...')
    const result = await request.query(queryText)
    console.log('✅ Query executed successfully')
    
    return result
  } catch (error) {
    console.error('❌ Query execution failed:', error)
    
    // If connection error, reset the pool
    if (error && typeof error === 'object' && 'code' in error) {
      const errorCode = (error as any).code
      if (['ECONNCLOSED', 'ETIMEOUT', 'ENOTOPEN'].includes(errorCode)) {
        console.log('🔄 Resetting connection pool due to error')
        globalPool = undefined
      }
    }
    
    throw error
  }
}

// Health check function
export async function vercelDbHealthCheck(): Promise<{
  connected: boolean
  error?: string
  poolInfo?: any
}> {
  try {
    const pool = await getVercelDbConnection()
    
    // Test with simple query
    await executeVercelQuery('SELECT 1 as test')
    
    return {
      connected: true,
      poolInfo: {
        connected: pool.connected,
        connecting: pool.connecting,
        healthy: pool.healthy
      }
    }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Cleanup function for serverless
export async function cleanupVercelDb(): Promise<void> {
  if (globalPool) {
    try {
      await globalPool.close()
      console.log('✅ Database connection closed')
    } catch (error) {
      console.error('❌ Error closing database:', error)
    }
    globalPool = undefined
  }
}