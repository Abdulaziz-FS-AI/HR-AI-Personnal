// Database configuration that handles multiple environment variable naming conventions
// This solves the issue where Vercel has different env var names than local development

export function getDatabaseConfig() {
  // Try multiple naming conventions for database configuration
  const config = {
    server: process.env.DB_SERVER || 
            process.env.AZURE_SQL_SERVER || 
            process.env.SQL_SERVER || 
            process.env.DATABASE_SERVER || '',
    
    database: process.env.DB_DATABASE || 
              process.env.AZURE_SQL_DATABASE || 
              process.env.SQL_DATABASE || 
              process.env.DATABASE_NAME || '',
    
    user: process.env.DB_USERNAME || 
          process.env.DB_USER ||
          process.env.AZURE_SQL_USER || 
          process.env.SQL_USER || 
          process.env.DATABASE_USER || '',
    
    password: process.env.DB_PASSWORD || 
              process.env.AZURE_SQL_PASSWORD || 
              process.env.SQL_PASSWORD || 
              process.env.DATABASE_PASSWORD || ''
  }

  // Log what we found
  console.log('Database configuration discovery:', {
    foundServer: !!config.server,
    foundDatabase: !!config.database,
    foundUser: !!config.user,
    foundPassword: !!config.password,
    serverSource: config.server ? 'found' : 'missing',
    isVercel: !!process.env.VERCEL
  })

  return config
}

export function validateDatabaseConfig() {
  const config = getDatabaseConfig()
  
  const missing: string[] = []
  if (!config.server) missing.push('server/AZURE_SQL_SERVER/DB_SERVER')
  if (!config.database) missing.push('database/AZURE_SQL_DATABASE/DB_DATABASE')
  if (!config.user) missing.push('user/AZURE_SQL_USER/DB_USERNAME')
  if (!config.password) missing.push('password/AZURE_SQL_PASSWORD/DB_PASSWORD')
  
  if (missing.length > 0) {
    throw new Error(`
Missing database configuration. 
Required environment variables (use ANY of these names):
${missing.map(m => `  - ${m}`).join('\n')}

Example:
  AZURE_SQL_SERVER=your-server.database.windows.net
  AZURE_SQL_DATABASE=your-database
  AZURE_SQL_USER=your-username
  AZURE_SQL_PASSWORD=your-password

Or:
  DB_SERVER=your-server.database.windows.net
  DB_DATABASE=your-database
  DB_USERNAME=your-username
  DB_PASSWORD=your-password
`)
  }
  
  return config
}