import sql from 'mssql'

/**
 * Database utility functions for serverless environment
 * Ensures proper connection management and cleanup
 */

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

/**
 * Execute a database query with automatic connection management
 * @param queryFn Function that executes the query using the pool
 * @returns Query result or null on error
 */
export async function executeQuery<T>(
  queryFn: (pool: sql.ConnectionPool) => Promise<T>
): Promise<T | null> {
  let pool: sql.ConnectionPool | null = null
  try {
    pool = new sql.ConnectionPool(config)
    await pool.connect()
    return await queryFn(pool)
  } catch (error) {
    console.error('Database query error:', error)
    return null
  } finally {
    if (pool) {
      try {
        await pool.close()
      } catch (error) {
        console.error('Error closing database connection:', error)
      }
    }
  }
}

/**
 * Execute a database query that should throw on error (for schema operations)
 * @param queryFn Function that executes the query using the pool
 * @returns Query result
 * @throws Database errors
 */
export async function executeQueryStrict<T>(
  queryFn: (pool: sql.ConnectionPool) => Promise<T>
): Promise<T> {
  let pool: sql.ConnectionPool | null = null
  try {
    pool = new sql.ConnectionPool(config)
    await pool.connect()
    return await queryFn(pool)
  } finally {
    if (pool) {
      try {
        await pool.close()
      } catch (error) {
        console.error('Error closing database connection:', error)
      }
    }
  }
}

/**
 * Check if database tables exist
 * @param tableNames Array of table names to check
 * @returns Object with table existence status
 */
export async function checkTablesExist(tableNames: string[]): Promise<Record<string, boolean>> {
  return await executeQuery(async (pool) => {
    const placeholders = tableNames.map((_, i) => `@table${i}`).join(',')
    const request = pool.request()
    
    tableNames.forEach((tableName, i) => {
      request.input(`table${i}`, sql.NVarChar, tableName)
    })
    
    const result = await request.query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE_TABLE'
      AND TABLE_NAME IN (${placeholders})
    `)
    
    const existingTables = result.recordset.map(row => row.TABLE_NAME)
    const status: Record<string, boolean> = {}
    
    tableNames.forEach(tableName => {
      status[tableName] = existingTables.includes(tableName)
    })
    
    return status
  }) || {}
}