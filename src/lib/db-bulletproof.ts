import sql from 'mssql'

interface ConnectionConfig {
  server: string
  database: string
  user: string
  password: string
  options: {
    encrypt: boolean
    trustServerCertificate: boolean
    requestTimeout: number
    connectionTimeout: number
    enableArithAbort: boolean
  }
  pool: {
    max: number
    min: number
    idleTimeoutMillis: number
    acquireTimeoutMillis: number
    createTimeoutMillis: number
    destroyTimeoutMillis: number
    reapIntervalMillis: number
    createRetryIntervalMillis: number
  }
}

class BulletproofDatabase {
  private static instance: BulletproofDatabase
  private pool: sql.ConnectionPool | null = null
  private config: ConnectionConfig
  private isConnecting: boolean = false
  private connectionAttempts: number = 0
  private maxRetries: number = 3
  private retryDelay: number = 1000

  private constructor() {
    // Initialize config as empty - will be set when first needed
    this.config = {} as ConnectionConfig
  }

  private initializeConfig(): void {
    if (!this.config.server) {
      // Log environment availability for debugging
      console.log('🔧 Initializing database config...')
      console.log('Environment check:', {
        hasServer: !!process.env.DB_SERVER,
        hasDatabase: !!process.env.DB_DATABASE,
        hasUser: !!process.env.DB_USERNAME,
        hasPassword: !!process.env.DB_PASSWORD,
        nodeEnv: process.env.NODE_ENV,
        isVercel: !!process.env.VERCEL
      })

      this.config = {
        server: process.env.DB_SERVER || '',
        database: process.env.DB_DATABASE || '',
        user: process.env.DB_USERNAME || '',
        password: process.env.DB_PASSWORD || '',
        options: {
          encrypt: true,
          trustServerCertificate: true,
          requestTimeout: 30000, // 30 seconds
          connectionTimeout: 30000, // 30 seconds
          enableArithAbort: true
        },
        pool: {
          max: 5, // Reduced for serverless
          min: 0,  // Minimum pool size
          idleTimeoutMillis: 10000, // 10 seconds - shorter for serverless
          acquireTimeoutMillis: 30000, // 30 seconds
          createTimeoutMillis: 30000, // 30 seconds  
          destroyTimeoutMillis: 5000, // 5 seconds
          reapIntervalMillis: 1000, // 1 second
          createRetryIntervalMillis: 200 // 200ms
        }
      }

      // Validate required config only when actually used (not during build)
      if (!this.config.server || !this.config.database || !this.config.user || !this.config.password) {
        console.error('❌ Missing database configuration:', {
          server: this.config.server ? 'present' : 'MISSING',
          database: this.config.database ? 'present' : 'MISSING',
          user: this.config.user ? 'present' : 'MISSING',
          password: this.config.password ? 'present' : 'MISSING'
        })
        throw new Error('Missing required database configuration. Check environment variables.')
      }
    }
  }

  static getInstance(): BulletproofDatabase {
    if (!BulletproofDatabase.instance) {
      BulletproofDatabase.instance = new BulletproofDatabase()
    }
    return BulletproofDatabase.instance
  }

  async getConnection(): Promise<sql.ConnectionPool> {
    // Initialize config on first use (not during build)
    this.initializeConfig()

    // If we have a healthy connection, return it
    if (this.pool && this.pool.connected && !this.pool.connecting) {
      return this.pool
    }

    // If already connecting, wait for it
    if (this.isConnecting) {
      return this.waitForConnection()
    }

    // Create new connection
    return this.createConnection()
  }

  private async createConnection(): Promise<sql.ConnectionPool> {
    this.isConnecting = true
    this.connectionAttempts++

    try {
      console.log(`🔌 Creating database connection (attempt ${this.connectionAttempts})...`)
      
      // Close existing connection if it exists
      if (this.pool) {
        try {
          await this.pool.close()
        } catch (closeError) {
          console.warn('Error closing existing connection:', closeError)
        }
      }

      // Create new pool with bulletproof config
      this.pool = new sql.ConnectionPool(this.config)
      
      // Set up error handlers
      this.pool.on('error', (err) => {
        console.error('🚨 Database pool error:', err)
        this.handleConnectionError(err)
      })

      // Connect with timeout
      const connectionPromise = this.pool.connect()
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 30000)
      })

      await Promise.race([connectionPromise, timeoutPromise])

      console.log('✅ Database connection established successfully')
      this.connectionAttempts = 0
      this.isConnecting = false
      
      return this.pool

    } catch (error) {
      this.isConnecting = false
      console.error(`❌ Database connection failed (attempt ${this.connectionAttempts}):`, error)

      // Retry logic
      if (this.connectionAttempts < this.maxRetries) {
        console.log(`⏳ Retrying connection in ${this.retryDelay}ms...`)
        await this.delay(this.retryDelay)
        this.retryDelay *= 2 // Exponential backoff
        return this.createConnection()
      }

      // Max retries exceeded
      this.connectionAttempts = 0
      this.retryDelay = 1000
      throw new Error(`Database connection failed after ${this.maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async waitForConnection(): Promise<sql.ConnectionPool> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (!this.isConnecting && this.pool && this.pool.connected) {
          clearInterval(checkInterval)
          resolve(this.pool)
        } else if (!this.isConnecting && (!this.pool || !this.pool.connected)) {
          clearInterval(checkInterval)
          reject(new Error('Connection failed during wait'))
        }
      }, 100)

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error('Timeout waiting for connection'))
      }, 30000)
    })
  }

  private handleConnectionError(error: Error) {
    console.error('🚨 Connection error detected:', error.message)
    
    // Mark pool as invalid
    if (this.pool) {
      this.pool = null
    }
    
    // Reset connection state
    this.isConnecting = false
    this.connectionAttempts = 0
  }

  async executeQuery<T = any>(
    queryText: string, 
    parameters?: Record<string, any>,
    retryCount: number = 0
  ): Promise<sql.IResult<T>> {
    try {
      const pool = await this.getConnection()
      const request = pool.request()

      // Add parameters if provided
      if (parameters) {
        Object.entries(parameters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            // Auto-detect parameter types
            if (typeof value === 'string') {
              request.input(key, sql.NVarChar, value)
            } else if (typeof value === 'number') {
              if (Number.isInteger(value)) {
                request.input(key, sql.Int, value)
              } else {
                request.input(key, sql.Float, value)
              }
            } else if (typeof value === 'boolean') {
              request.input(key, sql.Bit, value)
            } else if (value instanceof Date) {
              request.input(key, sql.DateTime2, value)
            } else {
              // For UUIDs and other special types
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

      // Retry logic for connection issues
      if (retryCount < 2 && this.isConnectionError(error)) {
        console.log(`⏳ Retrying query (attempt ${retryCount + 1})...`)
        
        // Reset connection
        this.handleConnectionError(error as Error)
        
        // Wait before retry
        await this.delay(1000 * (retryCount + 1))
        
        return this.executeQuery(queryText, parameters, retryCount + 1)
      }

      throw error
    }
  }

  private isConnectionError(error: any): boolean {
    const connectionErrors = [
      'ECONNCLOSED',
      'Connection is closed',
      'ConnectionError',
      'ETIMEOUT',
      'Connection timeout',
      'Pool is closed'
    ]
    
    const errorMessage = error?.message || error?.code || String(error)
    return connectionErrors.some(errType => errorMessage.includes(errType))
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async healthCheck(): Promise<{
    connected: boolean
    poolSize?: number
    totalConnections?: number
    idleConnections?: number
    error?: string
  }> {
    try {
      console.log('🏥 Starting health check...')
      
      // Initialize config before health check
      this.initializeConfig()
      
      const pool = await this.getConnection()
      
      // Test connection with simple query
      await this.executeQuery('SELECT 1 as test')
      
      const health = {
        connected: true,
        poolSize: pool.size,
        totalConnections: pool.totalConnectionCount,
        idleConnections: pool.idleConnectionCount
      }
      
      console.log('✅ Health check passed:', health)
      return health
      
    } catch (error) {
      console.error('❌ Health check failed:', error)
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async gracefulShutdown(): Promise<void> {
    console.log('🔄 Initiating graceful database shutdown...')
    
    if (this.pool) {
      try {
        await this.pool.close()
        console.log('✅ Database connection closed gracefully')
      } catch (error) {
        console.error('❌ Error during graceful shutdown:', error)
      }
    }
    
    this.pool = null
    this.isConnecting = false
    this.connectionAttempts = 0
  }
}

// Lazy singleton instance - only initialized when needed
let bulletproofDbInstance: BulletproofDatabase | null = null

function getBulletproofDbInstance(): BulletproofDatabase {
  if (!bulletproofDbInstance) {
    bulletproofDbInstance = BulletproofDatabase.getInstance()
  }
  return bulletproofDbInstance
}

// Export getter instead of direct instance
export const bulletproofDb = {
  getConnection: () => getBulletproofDbInstance().getConnection(),
  executeQuery: <T = any>(queryText: string, parameters?: Record<string, any>) => 
    getBulletproofDbInstance().executeQuery<T>(queryText, parameters),
  healthCheck: () => getBulletproofDbInstance().healthCheck(),
  gracefulShutdown: () => getBulletproofDbInstance().gracefulShutdown()
}

// Convenience function for backward compatibility
export async function getBulletproofConnection(): Promise<sql.ConnectionPool> {
  return getBulletproofDbInstance().getConnection()
}

// Execute query with bulletproof error handling
export async function executeQuerySafely<T = any>(
  queryText: string,
  parameters?: Record<string, any>
): Promise<sql.IResult<T>> {
  return getBulletproofDbInstance().executeQuery<T>(queryText, parameters)
}