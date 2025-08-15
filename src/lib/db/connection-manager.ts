import sql from 'mssql'
import { getDatabaseConfig } from '@/lib/db-config-vercel'

// Global connection pool for serverless optimization
let globalPool: sql.ConnectionPool | undefined
let connectionPromise: Promise<sql.ConnectionPool> | undefined

/**
 * Get a database connection with proper error handling and connection reuse
 */
export async function getDbConnection(): Promise<sql.ConnectionPool> {
  // If we already have a connected pool, return it
  if (globalPool?.connected) {
    return globalPool
  }

  // If we're already connecting, wait for that connection
  if (connectionPromise) {
    return connectionPromise
  }

  // Create new connection
  connectionPromise = createConnection()
  
  try {
    globalPool = await connectionPromise
    return globalPool
  } catch (error) {
    // Reset promise on failure so we can retry
    connectionPromise = undefined
    throw error
  }
}

/**
 * Create a new database connection
 */
async function createConnection(): Promise<sql.ConnectionPool> {
  const dbConfig = getDatabaseConfig()
  
  if (!dbConfig.server || !dbConfig.database || !dbConfig.user || !dbConfig.password) {
    throw new Error('Database configuration missing. Check environment variables.')
  }

  const config: sql.config = {
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
      max: 5, // Increased for better concurrency
      min: 0,
      idleTimeoutMillis: 30000, // 30 seconds
      acquireTimeoutMillis: 60000 // 60 seconds
    },
    connectionTimeout: 30000,
    requestTimeout: 30000
  }

  try {
    const pool = new sql.ConnectionPool(config)
    
    // Add error handlers
    pool.on('error', (err) => {
      console.error('Database pool error:', err)
      globalPool = undefined
      connectionPromise = undefined
    })

    await pool.connect()
    console.log('✅ Database connected successfully')
    
    return pool
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    globalPool = undefined
    connectionPromise = undefined
    throw new Error(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Execute a database operation with automatic connection management and error handling
 */
export async function withDbConnection<T>(
  operation: (pool: sql.ConnectionPool) => Promise<T>
): Promise<T> {
  const pool = await getDbConnection()
  
  try {
    return await operation(pool)
  } catch (error) {
    console.error('Database operation failed:', error)
    
    // If it's a connection error, reset the pool
    if (error instanceof sql.ConnectionError || error instanceof sql.RequestError) {
      if (globalPool) {
        await globalPool.close().catch(() => {}) // Ignore close errors
        globalPool = undefined
        connectionPromise = undefined
      }
    }
    
    throw error
  }
}

/**
 * Gracefully close database connections (for cleanup)
 */
export async function closeDbConnections(): Promise<void> {
  if (globalPool) {
    try {
      await globalPool.close()
      console.log('✅ Database connections closed')
    } catch (error) {
      console.error('❌ Error closing database connections:', error)
    } finally {
      globalPool = undefined
      connectionPromise = undefined
    }
  }
}

/**
 * Check database connection health
 */
export async function checkDbHealth(): Promise<{ healthy: boolean; message: string }> {
  try {
    const pool = await getDbConnection()
    await pool.request().query('SELECT 1 as health_check')
    return { healthy: true, message: 'Database connection healthy' }
  } catch (error) {
    return { 
      healthy: false, 
      message: `Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}