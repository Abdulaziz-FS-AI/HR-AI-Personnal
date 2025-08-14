import sql from 'mssql'

/**
 * Validates that all required database environment variables are present
 * @throws {Error} If any required environment variable is missing
 */
function validateDatabaseConfig() {
  const required = [
    'AZURE_SQL_SERVER',
    'AZURE_SQL_DATABASE', 
    'AZURE_SQL_USER',
    'AZURE_SQL_PASSWORD'
  ]
  
  const missing = required.filter(env => !process.env[env])
  if (missing.length > 0) {
    throw new Error(
      `Missing required database environment variables: ${missing.join(', ')}\n` +
      'Please ensure all database credentials are properly configured in your environment.'
    )
  }
}

// Validate configuration on module load
validateDatabaseConfig()

const config = {
  server: process.env.AZURE_SQL_SERVER!,
  database: process.env.AZURE_SQL_DATABASE!,
  user: process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectionTimeout: 30000,
    requestTimeout: 30000,
  },
}

// Serverless-compatible connection function (no global pooling)
export async function getDbConnection() {
  try {
    const pool = new sql.ConnectionPool(config)
    await pool.connect()
    return pool
  } catch (error) {
    console.error('Database connection error:', error)
    throw new Error(`Failed to connect to Azure SQL Database: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export function getServerConfig() {
  return config
}