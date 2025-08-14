import { NextResponse } from 'next/server'

export async function GET() {
  // Check which environment variables are available
  const envStatus = {
    // Database configuration
    DB_SERVER: !!process.env.DB_SERVER,
    DB_DATABASE: !!process.env.DB_DATABASE,
    DB_USERNAME: !!process.env.DB_USERNAME,
    DB_PASSWORD: !!process.env.DB_PASSWORD,
    
    // Azure Storage
    AZURE_STORAGE_CONNECTION_STRING: !!process.env.AZURE_STORAGE_CONNECTION_STRING,
    AZURE_STORAGE_ACCOUNT_NAME: !!process.env.AZURE_STORAGE_ACCOUNT_NAME,
    AZURE_STORAGE_ACCOUNT_KEY: !!process.env.AZURE_STORAGE_ACCOUNT_KEY,
    
    // NextAuth
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    
    // OAuth
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    MICROSOFT_CLIENT_ID: !!process.env.MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET: !!process.env.MICROSOFT_CLIENT_SECRET,
    
    // AI Service
    HYPERBOLIC_API_KEY: !!process.env.HYPERBOLIC_API_KEY,
    
    // Vercel-specific
    VERCEL: !!process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV || 'not-set',
    NODE_ENV: process.env.NODE_ENV || 'not-set',
    
    // Check if any DB vars exist with different names
    DATABASE_URL: !!process.env.DATABASE_URL,
    AZURE_SQL_CONNECTION_STRING: !!process.env.AZURE_SQL_CONNECTION_STRING,
    SQL_SERVER: !!process.env.SQL_SERVER,
    SQL_DATABASE: !!process.env.SQL_DATABASE,
    SQL_USER: !!process.env.SQL_USER,
    SQL_PASSWORD: !!process.env.SQL_PASSWORD,
  }
  
  // Count how many are set
  const totalVars = Object.keys(envStatus).length
  const setVars = Object.values(envStatus).filter(v => v === true).length
  
  // Categorize missing vars
  const missing = {
    database: [],
    storage: [],
    auth: [],
    other: []
  }
  
  if (!envStatus.DB_SERVER) missing.database.push('DB_SERVER')
  if (!envStatus.DB_DATABASE) missing.database.push('DB_DATABASE')
  if (!envStatus.DB_USERNAME) missing.database.push('DB_USERNAME')
  if (!envStatus.DB_PASSWORD) missing.database.push('DB_PASSWORD')
  
  if (!envStatus.AZURE_STORAGE_CONNECTION_STRING) missing.storage.push('AZURE_STORAGE_CONNECTION_STRING')
  if (!envStatus.AZURE_STORAGE_ACCOUNT_NAME) missing.storage.push('AZURE_STORAGE_ACCOUNT_NAME')
  if (!envStatus.AZURE_STORAGE_ACCOUNT_KEY) missing.storage.push('AZURE_STORAGE_ACCOUNT_KEY')
  
  if (!envStatus.NEXTAUTH_SECRET) missing.auth.push('NEXTAUTH_SECRET')
  if (!envStatus.NEXTAUTH_URL) missing.auth.push('NEXTAUTH_URL')
  
  const hasCriticalDbVars = envStatus.DB_SERVER && envStatus.DB_DATABASE && 
                            envStatus.DB_USERNAME && envStatus.DB_PASSWORD
  
  return NextResponse.json({
    success: true,
    environment: {
      isVercel: envStatus.VERCEL,
      vercelEnv: envStatus.VERCEL_ENV,
      nodeEnv: envStatus.NODE_ENV
    },
    summary: {
      total: totalVars,
      configured: setVars,
      missing: totalVars - setVars,
      percentage: Math.round((setVars / totalVars) * 100) + '%'
    },
    critical: {
      databaseConfigured: hasCriticalDbVars,
      message: hasCriticalDbVars ? 
        'Database environment variables are configured' : 
        'CRITICAL: Database environment variables are NOT configured in Vercel!'
    },
    variables: envStatus,
    missingByCategory: missing,
    instructions: !hasCriticalDbVars ? {
      message: 'You need to add environment variables in Vercel Dashboard',
      steps: [
        '1. Go to your Vercel project dashboard',
        '2. Navigate to Settings → Environment Variables',
        '3. Add the following variables:',
        '   - DB_SERVER: Your Azure SQL server address',
        '   - DB_DATABASE: Your database name',
        '   - DB_USERNAME: Your database username',
        '   - DB_PASSWORD: Your database password',
        '4. Redeploy your application after adding variables'
      ],
      required: missing.database
    } : null,
    timestamp: new Date().toISOString()
  })
}