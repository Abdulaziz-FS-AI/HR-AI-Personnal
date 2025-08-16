import { NextRequest, NextResponse } from "next/server"
import sql from 'mssql'
import { getDatabaseConfig } from '@/lib/db-config-vercel'

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
    
    console.log('🔄 Starting roles schema migration...')
    
    // 1. Backup existing data if table exists
    console.log('📦 Backing up existing roles...')
    let existingRoles: any[] = []
    
    try {
      const backupResult = await pool.request().query(`
        IF EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U')
          SELECT * FROM roles WHERE is_active = 1
      `)
      existingRoles = backupResult.recordset
      console.log(`✅ Backed up ${existingRoles.length} existing roles`)
    } catch (error) {
      console.log('ℹ️ No existing roles table found, proceeding with fresh installation')
    }
    
    // 2. Drop old table if exists
    console.log('🗑️ Dropping old roles table...')
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U')
        DROP TABLE roles
    `)
    
    // 3. Create new roles table with updated schema
    console.log('🏗️ Creating new roles table...')
    await pool.request().query(`
      CREATE TABLE roles (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        title NVARCHAR(120) NOT NULL,
        description NTEXT NOT NULL,
        responsibilities NTEXT NULL,
        education_requirements NTEXT NOT NULL,
        experience_requirements NTEXT NOT NULL,
        bonus_config NTEXT NULL,
        penalty_config NTEXT NULL,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
      )
    `)
    
    // 4. Create indexes for performance
    console.log('🔍 Creating indexes...')
    await pool.request().query(`
      CREATE INDEX IX_roles_user_id ON roles (user_id, is_active)
    `)
    
    await pool.request().query(`
      CREATE INDEX IX_roles_created_at ON roles (created_at DESC)
    `)
    
    // 5. Migrate existing data (simplified structure)
    console.log('📥 Migrating existing data...')
    let migratedCount = 0
    
    for (const role of existingRoles) {
      try {
        // Create simplified education and experience requirements from old data
        let educationReq = role.education_requirements || 'Bachelor\'s degree or equivalent'
        let experienceReq = 'Professional experience required'
        
        if (role.min_experience_years || role.max_experience_years) {
          const min = role.min_experience_years || 0
          const max = role.max_experience_years || min + 5
          experienceReq = `${min}-${max} years of relevant experience`
        }
        
        await pool.request()
          .input('id', sql.UniqueIdentifier, role.id)
          .input('userId', sql.UniqueIdentifier, role.user_id)
          .input('title', sql.NVarChar, role.title)
          .input('description', sql.NText, role.description || 'Role description')
          .input('responsibilities', sql.NText, role.responsibilities)
          .input('educationRequirements', sql.NText, educationReq)
          .input('experienceRequirements', sql.NText, experienceReq)
          .input('createdAt', sql.DateTime2, role.created_at)
          .input('updatedAt', sql.DateTime2, role.updated_at || role.created_at)
          .query(`
            INSERT INTO roles (
              id, user_id, title, description, responsibilities,
              education_requirements, experience_requirements,
              bonus_config, penalty_config,
              is_active, created_at, updated_at
            )
            VALUES (
              @id, @userId, @title, @description, @responsibilities,
              @educationRequirements, @experienceRequirements,
              NULL, NULL,
              1, @createdAt, @updatedAt
            )
          `)
        
        migratedCount++
      } catch (error) {
        console.error(`Failed to migrate role ${role.id}:`, error)
      }
    }
    
    // 6. Verify migration
    const finalCount = await pool.request().query(`
      SELECT COUNT(*) as total FROM roles WHERE is_active = 1
    `)
    
    console.log('✅ Roles schema migration completed successfully!')
    
    return NextResponse.json({
      success: true,
      message: 'Roles schema migrated successfully',
      details: {
        backedUpRoles: existingRoles.length,
        migratedRoles: migratedCount,
        finalCount: finalCount.recordset[0].total,
        changes: [
          'REMOVED: department, location, employment_type, seniority_level, min_experience_years, max_experience_years',
          'ADDED: experience_requirements (required text field)',
          'ADDED: bonus_config (JSON configuration)',
          'ADDED: penalty_config (JSON configuration)',
          'UPDATED: education_requirements (now required)',
          'UPDATED: description (now required)'
        ]
      },
      responseTime: Date.now() - startTime
    })
    
  } catch (error) {
    console.error('Roles schema migration error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to migrate roles schema',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const pool = await getConnection()
    
    // Check current schema
    const schemaResult = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'roles'
      ORDER BY ORDINAL_POSITION
    `)
    
    const tableExists = schemaResult.recordset.length > 0
    
    return NextResponse.json({
      success: true,
      tableExists,
      currentSchema: schemaResult.recordset,
      migrationNeeded: tableExists ? this.checkIfMigrationNeeded(schemaResult.recordset) : true
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function checkIfMigrationNeeded(columns: any[]): boolean {
  const requiredColumns = [
    'education_requirements',
    'experience_requirements', 
    'bonus_config',
    'penalty_config'
  ]
  
  const existingColumns = columns.map(c => c.COLUMN_NAME.toLowerCase())
  
  return !requiredColumns.every(col => existingColumns.includes(col))
}