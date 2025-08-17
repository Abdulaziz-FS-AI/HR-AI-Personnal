/**
 * DATABASE MIGRATION: Enhanced Requirements Schema
 * 
 * Migrates education and experience requirements from simple strings
 * to structured objects with hasRequirements flags for better UX
 * 
 * SENIOR BACKEND PROFESSIONAL IMPLEMENTATION
 */

import { NextRequest, NextResponse } from 'next/server'
import sql from 'mssql'
import { getDatabaseConfig } from '@/lib/db-config-vercel'

// Global connection pool for serverless optimization
let globalPool: sql.ConnectionPool | undefined

async function getConnection(): Promise<sql.ConnectionPool> {
  if (globalPool?.connected) {
    return globalPool
  }

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
      max: 3,
      min: 0,
      idleTimeoutMillis: 10000
    }
  }

  try {
    const pool = new sql.ConnectionPool(config)
    await pool.connect()
    globalPool = pool
    return pool
  } catch (error) {
    globalPool = undefined
    throw error
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const pool = await getConnection()
    
    console.log('🔧 Starting enhanced requirements schema migration...')
    
    // 1. Check if new columns already exist
    const columnsCheck = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'roles' 
        AND COLUMN_NAME IN ('education_requirements_enabled', 'experience_requirements_enabled')
    `)
    
    if (columnsCheck.recordset.length === 0) {
      // 2. Add new columns for enhanced requirements
      console.log('📊 Adding new requirements control columns...')
      await pool.request().query(`
        ALTER TABLE roles 
        ADD education_requirements_enabled BIT DEFAULT 1,
            experience_requirements_enabled BIT DEFAULT 1
      `)
      
      // 3. Initialize existing data based on content analysis
      console.log('🔄 Migrating existing requirements data...')
      await pool.request().query(`
        UPDATE roles 
        SET education_requirements_enabled = CASE 
          WHEN education_requirements IS NOT NULL 
            AND LEN(TRIM(education_requirements)) > 0 
            AND education_requirements NOT LIKE '%no %requirements%'
            AND education_requirements NOT LIKE '%not required%'
          THEN 1 
          ELSE 0 
        END
      `)
      
      await pool.request().query(`
        UPDATE roles 
        SET experience_requirements_enabled = CASE 
          WHEN experience_requirements IS NOT NULL 
            AND LEN(TRIM(experience_requirements)) > 0 
            AND experience_requirements NOT LIKE '%no %requirements%'
            AND experience_requirements NOT LIKE '%not required%'
            AND experience_requirements NOT LIKE '%entry%level%'
          THEN 1 
          ELSE 0 
        END
      `)
      
      console.log('✅ Requirements schema migration completed')
    } else {
      console.log('ℹ️  Enhanced requirements columns already exist')
    }
    
    // 4. Update evaluation_results table for enhanced analysis storage
    const resultsColumnsCheck = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'evaluation_results' 
        AND COLUMN_NAME IN ('education_analysis', 'experience_analysis')
    `)
    
    if (resultsColumnsCheck.recordset.length === 0) {
      console.log('📈 Adding enhanced analysis storage columns...')
      await pool.request().query(`
        ALTER TABLE evaluation_results 
        ADD education_analysis NVARCHAR(MAX) NULL,
            experience_analysis NVARCHAR(MAX) NULL
      `)
      
      console.log('✅ Analysis storage enhancement completed')
    } else {
      console.log('ℹ️  Enhanced analysis columns already exist')
    }
    
    // 5. Verify migration success
    const verificationQuery = await pool.request().query(`
      SELECT 
        COUNT(*) as total_roles,
        SUM(CASE WHEN education_requirements_enabled = 1 THEN 1 ELSE 0 END) as roles_with_education,
        SUM(CASE WHEN experience_requirements_enabled = 1 THEN 1 ELSE 0 END) as roles_with_experience
      FROM roles
    `)
    
    const stats = verificationQuery.recordset[0]
    
    return NextResponse.json({
      success: true,
      message: 'Enhanced requirements schema deployed successfully',
      migration: {
        columnsAdded: columnsCheck.recordset.length === 0,
        analysisStorageAdded: resultsColumnsCheck.recordset.length === 0,
        migratedRoles: {
          total: stats.total_roles,
          withEducationRequirements: stats.roles_with_education,
          withExperienceRequirements: stats.roles_with_experience
        }
      },
      responseTime: Date.now() - startTime
    })
    
  } catch (error) {
    console.error('❌ Requirements schema migration failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to deploy enhanced requirements schema',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const pool = await getConnection()
    
    // Check current schema status
    const schemaStatus = await pool.request().query(`
      SELECT 
        CASE WHEN EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'roles' AND COLUMN_NAME = 'education_requirements_enabled'
        ) THEN 1 ELSE 0 END as has_enhanced_requirements,
        CASE WHEN EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'evaluation_results' AND COLUMN_NAME = 'education_analysis'
        ) THEN 1 ELSE 0 END as has_enhanced_analysis
    `)
    
    const status = schemaStatus.recordset[0]
    
    return NextResponse.json({
      success: true,
      schema: {
        enhancedRequirements: Boolean(status.has_enhanced_requirements),
        enhancedAnalysis: Boolean(status.has_enhanced_analysis),
        ready: Boolean(status.has_enhanced_requirements && status.has_enhanced_analysis)
      }
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to check schema status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}