import sql from 'mssql'

/**
 * Production-ready lazy database configuration
 * This only initializes when actually needed, not during build
 */
let config: sql.config | null = null
let isConfigured = false

/**
 * Get database configuration lazily
 * This prevents build-time errors when env vars aren't available
 */
function getConfig(): sql.config {
  if (!isConfigured) {
    // Check if we have required environment variables
    const hasConfig = !!(
      process.env.AZURE_SQL_SERVER &&
      process.env.AZURE_SQL_DATABASE &&
      process.env.AZURE_SQL_USER &&
      process.env.AZURE_SQL_PASSWORD
    )

    if (!hasConfig) {
      throw new Error(
        'Database not configured. Please set AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, and AZURE_SQL_PASSWORD environment variables.'
      )
    }

    config = {
      server: process.env.AZURE_SQL_SERVER,
      database: process.env.AZURE_SQL_DATABASE,
      user: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD,
      options: {
        encrypt: true,
        trustServerCertificate: false,
        connectionTimeout: 30000,
        requestTimeout: 30000,
      },
    }
    isConfigured = true
  }

  return config!
}

/**
 * Get a database connection
 * This is lazy-loaded and only connects when actually called
 */
export async function getDbConnection() {
  try {
    const dbConfig = getConfig()
    const pool = new sql.ConnectionPool(dbConfig)
    await pool.connect()
    return pool
  } catch (error) {
    console.error('Database connection error:', error)
    throw new Error(`Failed to connect to Azure SQL Database: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Check if database is configured (without throwing errors)
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
 * Get server configuration (if available)
 */
export function getServerConfig() {
  try {
    return getConfig()
  } catch {
    return null
  }
}