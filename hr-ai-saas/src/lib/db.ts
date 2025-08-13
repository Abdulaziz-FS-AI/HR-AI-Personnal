import sql from 'mssql'
import { executeQuery } from './db-utils'

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

const config: sql.config = {
  server: process.env.AZURE_SQL_SERVER!,
  database: process.env.AZURE_SQL_DATABASE!,
  user: process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  pool: {
    max: 5, // Maximum number of connections in pool
    min: 1, // Minimum number of connections in pool
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    acquireTimeoutMillis: 30000, // Maximum time to wait for a connection
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
  cancelTimeout: 5000,
}

// Global connection pool for serverless optimization
let globalPool: sql.ConnectionPool | null = null
let poolPromise: Promise<sql.ConnectionPool> | null = null

// Serverless-optimized connection function with proper pooling
export async function getDbConnection(): Promise<sql.ConnectionPool> {
  try {
    // Return existing pool if available and connected
    if (globalPool && globalPool.connected) {
      return globalPool
    }

    // If pool creation is in progress, wait for it
    if (poolPromise) {
      return await poolPromise
    }

    // Create new pool
    poolPromise = createPool()
    globalPool = await poolPromise
    poolPromise = null

    return globalPool
  } catch (error) {
    poolPromise = null
    globalPool = null
    console.error('Database connection failed:', error)
    throw new Error(`Failed to connect to Azure SQL Database: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function createPool(): Promise<sql.ConnectionPool> {
  const pool = new sql.ConnectionPool(config)
  
  // Add connection event handlers
  pool.on('connect', () => {
    console.log('✅ Database connection established')
  })
  
  pool.on('error', (err) => {
    console.error('❌ Database pool error:', err)
    globalPool = null
    poolPromise = null
  })

  await pool.connect()
  return pool
}

// Graceful cleanup function for serverless environments
export async function closeDbConnection() {
  try {
    if (globalPool) {
      await globalPool.close()
      globalPool = null
      poolPromise = null
      console.log('✅ Database pool closed')
    }
  } catch (error) {
    console.error('Error closing database pool:', error)
  }
}

// Health check function
export async function checkDbHealth(): Promise<{ connected: boolean; poolSize?: number; error?: string }> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request().query('SELECT 1 as test')
    return {
      connected: true,
      poolSize: pool.pool?.size || 0
    }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export interface User {
  id: string
  email: string
  passwordHash: string
  companyName: string | null
  firstName: string | null
  lastName: string | null
  subscriptionTier: string
  creditsRemaining: number
  createdAt: Date
  isActive: boolean
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return await executeQuery(async (pool) => {
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query(`
        SELECT id, email, password_hash as passwordHash, company_name as companyName,
               first_name as firstName, last_name as lastName, subscription_tier as subscriptionTier,
               credits_remaining as creditsRemaining, created_at as createdAt, is_active as isActive
        FROM users 
        WHERE email = @email AND is_active = 1
      `)
    
    return result.recordset[0] || null
  })
}

export async function createUser(userData: {
  email: string
  passwordHash: string
  companyName?: string
  firstName?: string
  lastName?: string
}): Promise<User | null> {
  return await executeQuery(async (pool) => {
    const result = await pool.request()
      .input('email', sql.NVarChar, userData.email)
      .input('passwordHash', sql.NVarChar, userData.passwordHash)
      .input('companyName', sql.NVarChar, userData.companyName || null)
      .input('firstName', sql.NVarChar, userData.firstName || null)
      .input('lastName', sql.NVarChar, userData.lastName || null)
      .query(`
        INSERT INTO users (email, password_hash, company_name, first_name, last_name, credits_remaining)
        OUTPUT INSERTED.id, INSERTED.email, INSERTED.password_hash as passwordHash,
               INSERTED.company_name as companyName, INSERTED.first_name as firstName,
               INSERTED.last_name as lastName, INSERTED.subscription_tier as subscriptionTier,
               INSERTED.credits_remaining as creditsRemaining, INSERTED.created_at as createdAt,
               INSERTED.is_active as isActive
        VALUES (@email, @passwordHash, @companyName, @firstName, @lastName, 10)
      `)
    
    return result.recordset[0] || null
  })
}

export async function createUserFromOAuth(userData: {
  email: string
  firstName?: string
  lastName?: string
  googleId?: string
  microsoftId?: string
  avatar?: string
}): Promise<User | null> {
  return await executeQuery(async (pool) => {
    const result = await pool.request()
      .input('email', sql.NVarChar, userData.email)
      .input('passwordHash', sql.NVarChar, '') // Empty password for OAuth users
      .input('firstName', sql.NVarChar, userData.firstName || null)
      .input('lastName', sql.NVarChar, userData.lastName || null)
      .query(`
        INSERT INTO users (email, password_hash, first_name, last_name, credits_remaining)
        OUTPUT INSERTED.id, INSERTED.email, INSERTED.password_hash as passwordHash,
               INSERTED.company_name as companyName, INSERTED.first_name as firstName,
               INSERTED.last_name as lastName, INSERTED.subscription_tier as subscriptionTier,
               INSERTED.credits_remaining as creditsRemaining, INSERTED.created_at as createdAt,
               INSERTED.is_active as isActive
        VALUES (@email, @passwordHash, @firstName, @lastName, 10)
      `)
    
    return result.recordset[0] || null
  })
}

export interface Role {
  id: string
  userId: string
  title: string
  description: string | null
  responsibilities: string | null
  department: string | null
  location: string | null
  employmentType: string | null
  seniorityLevel: string | null
  minExperienceYears: number | null
  maxExperienceYears: number | null
  educationRequirements: string | null
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

export async function getRolesByUserId(userId: string): Promise<Role[]> {
  return await executeQuery(async (pool) => {
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT id, user_id as userId, title, description, responsibilities,
               department, location, employment_type as employmentType,
               seniority_level as seniorityLevel, min_experience_years as minExperienceYears,
               max_experience_years as maxExperienceYears, education_requirements as educationRequirements,
               created_at as createdAt, updated_at as updatedAt, is_active as isActive
        FROM roles 
        WHERE user_id = @userId AND is_active = 1
        ORDER BY created_at DESC
      `)
    
    return result.recordset
  }).catch(error => {
    console.error('Database error:', error)
    return []
  })
}

export async function createRole(roleData: Omit<Role, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>): Promise<Role | null> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, roleData.userId)
      .input('title', sql.NVarChar, roleData.title)
      .input('description', sql.NText, roleData.description)
      .input('responsibilities', sql.NText, roleData.responsibilities)
      .input('department', sql.NVarChar, roleData.department)
      .input('location', sql.NVarChar, roleData.location)
      .input('employmentType', sql.NVarChar, roleData.employmentType)
      .input('seniorityLevel', sql.NVarChar, roleData.seniorityLevel)
      .input('minExperienceYears', sql.Int, roleData.minExperienceYears)
      .input('maxExperienceYears', sql.Int, roleData.maxExperienceYears)
      .input('educationRequirements', sql.NText, roleData.educationRequirements)
      .query(`
        INSERT INTO roles (user_id, title, description, responsibilities, department, location,
                          employment_type, seniority_level, min_experience_years, max_experience_years,
                          education_requirements)
        OUTPUT INSERTED.id, INSERTED.user_id as userId, INSERTED.title, INSERTED.description,
               INSERTED.responsibilities, INSERTED.department, INSERTED.location,
               INSERTED.employment_type as employmentType, INSERTED.seniority_level as seniorityLevel,
               INSERTED.min_experience_years as minExperienceYears,
               INSERTED.max_experience_years as maxExperienceYears,
               INSERTED.education_requirements as educationRequirements,
               INSERTED.created_at as createdAt, INSERTED.updated_at as updatedAt,
               INSERTED.is_active as isActive
        VALUES (@userId, @title, @description, @responsibilities, @department, @location,
                @employmentType, @seniorityLevel, @minExperienceYears, @maxExperienceYears,
                @educationRequirements)
      `)
    
    return result.recordset[0] || null
  } catch (error) {
    console.error('Database error:', error)
    return null
  }
}

export async function getRoleById(roleId: string, userId: string): Promise<Role | null> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, roleId)
      .input('userId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT id, user_id as userId, title, description, responsibilities,
               department, location, employment_type as employmentType,
               seniority_level as seniorityLevel, min_experience_years as minExperienceYears,
               max_experience_years as maxExperienceYears, education_requirements as educationRequirements,
               created_at as createdAt, updated_at as updatedAt, is_active as isActive
        FROM roles 
        WHERE id = @roleId AND user_id = @userId AND is_active = 1
      `)
    
    return result.recordset[0] || null
  } catch (error) {
    console.error('Database error:', error)
    return null
  }
}

export async function updateRole(roleId: string, userId: string, updates: Partial<Role>): Promise<Role | null> {
  try {
    const pool = await getDbConnection()
    
    // Build dynamic update query
    const updateFields = []
    const request = pool.request()
      .input('roleId', sql.UniqueIdentifier, roleId)
      .input('userId', sql.UniqueIdentifier, userId)
      .input('updatedAt', sql.DateTime2, new Date())
    
    if (updates.title) {
      updateFields.push('title = @title')
      request.input('title', sql.NVarChar, updates.title)
    }
    if (updates.description !== undefined) {
      updateFields.push('description = @description')
      request.input('description', sql.NText, updates.description)
    }
    if (updates.responsibilities !== undefined) {
      updateFields.push('responsibilities = @responsibilities')
      request.input('responsibilities', sql.NText, updates.responsibilities)
    }
    if (updates.department !== undefined) {
      updateFields.push('department = @department')
      request.input('department', sql.NVarChar, updates.department)
    }
    if (updates.location !== undefined) {
      updateFields.push('location = @location')
      request.input('location', sql.NVarChar, updates.location)
    }
    if (updates.employmentType !== undefined) {
      updateFields.push('employment_type = @employmentType')
      request.input('employmentType', sql.NVarChar, updates.employmentType)
    }
    if (updates.seniorityLevel !== undefined) {
      updateFields.push('seniority_level = @seniorityLevel')
      request.input('seniorityLevel', sql.NVarChar, updates.seniorityLevel)
    }
    if (updates.minExperienceYears !== undefined) {
      updateFields.push('min_experience_years = @minExperienceYears')
      request.input('minExperienceYears', sql.Int, updates.minExperienceYears)
    }
    if (updates.maxExperienceYears !== undefined) {
      updateFields.push('max_experience_years = @maxExperienceYears')
      request.input('maxExperienceYears', sql.Int, updates.maxExperienceYears)
    }
    if (updates.educationRequirements !== undefined) {
      updateFields.push('education_requirements = @educationRequirements')
      request.input('educationRequirements', sql.NText, updates.educationRequirements)
    }
    
    if (updateFields.length === 0) {
      return null // No fields to update
    }
    
    updateFields.push('updated_at = @updatedAt')
    
    const result = await request.query(`
      UPDATE roles 
      SET ${updateFields.join(', ')}
      OUTPUT INSERTED.id, INSERTED.user_id as userId, INSERTED.title, INSERTED.description,
             INSERTED.responsibilities, INSERTED.department, INSERTED.location,
             INSERTED.employment_type as employmentType, INSERTED.seniority_level as seniorityLevel,
             INSERTED.min_experience_years as minExperienceYears,
             INSERTED.max_experience_years as maxExperienceYears,
             INSERTED.education_requirements as educationRequirements,
             INSERTED.created_at as createdAt, INSERTED.updated_at as updatedAt,
             INSERTED.is_active as isActive
      WHERE id = @roleId AND user_id = @userId AND is_active = 1
    `)
    
    return result.recordset[0] || null
  } catch (error) {
    console.error('Database error:', error)
    return null
  }
}

export async function deleteRole(roleId: string, userId: string): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, roleId)
      .input('userId', sql.UniqueIdentifier, userId)
      .query(`
        UPDATE roles 
        SET is_active = 0, updated_at = GETUTCDATE()
        WHERE id = @roleId AND user_id = @userId AND is_active = 1
      `)
    
    return result.rowsAffected[0] > 0
  } catch (error) {
    console.error('Database error:', error)
    return false
  }
}

// Role Skills Operations
export interface RoleSkill {
  id: string
  roleId: string
  skillName: string
  weight: number
  isRequired: boolean
  skillCategory: string | null
  createdAt: Date
}

export async function getRoleSkills(roleId: string): Promise<RoleSkill[]> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, roleId)
      .query(`
        SELECT id, role_id as roleId, skill_name as skillName, weight,
               is_required as isRequired, skill_category as skillCategory,
               created_at as createdAt
        FROM role_skills 
        WHERE role_id = @roleId
        ORDER BY weight DESC, skill_name
      `)
    
    return result.recordset
  } catch (error) {
    console.error('Database error:', error)
    return []
  }
}

export async function createRoleSkill(skillData: Omit<RoleSkill, 'id' | 'createdAt'>): Promise<RoleSkill | null> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, skillData.roleId)
      .input('skillName', sql.NVarChar, skillData.skillName)
      .input('weight', sql.Int, skillData.weight)
      .input('isRequired', sql.Bit, skillData.isRequired)
      .input('skillCategory', sql.NVarChar, skillData.skillCategory)
      .query(`
        INSERT INTO role_skills (role_id, skill_name, weight, is_required, skill_category)
        OUTPUT INSERTED.id, INSERTED.role_id as roleId, INSERTED.skill_name as skillName,
               INSERTED.weight, INSERTED.is_required as isRequired,
               INSERTED.skill_category as skillCategory, INSERTED.created_at as createdAt
        VALUES (@roleId, @skillName, @weight, @isRequired, @skillCategory)
      `)
    
    return result.recordset[0] || null
  } catch (error) {
    console.error('Database error:', error)
    return null
  }
}

export async function deleteRoleSkill(skillId: string): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('skillId', sql.UniqueIdentifier, skillId)
      .query(`
        DELETE FROM role_skills WHERE id = @skillId
      `)
    
    return result.rowsAffected[0] > 0
  } catch (error) {
    console.error('Database error:', error)
    return false
  }
}

// Role Questions Operations
export interface RoleQuestion {
  id: string
  roleId: string
  questionText: string
  weight: number
  category: string | null
  isActive: boolean
  createdAt: Date
}

export async function getRoleQuestions(roleId: string): Promise<RoleQuestion[]> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, roleId)
      .query(`
        SELECT id, role_id as roleId, question_text as questionText, weight,
               category, is_active as isActive, created_at as createdAt
        FROM role_questions 
        WHERE role_id = @roleId AND is_active = 1
        ORDER BY weight DESC, created_at
      `)
    
    return result.recordset
  } catch (error) {
    console.error('Database error:', error)
    return []
  }
}

export async function createRoleQuestion(questionData: Omit<RoleQuestion, 'id' | 'createdAt' | 'isActive'>): Promise<RoleQuestion | null> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, questionData.roleId)
      .input('questionText', sql.NText, questionData.questionText)
      .input('weight', sql.Int, questionData.weight)
      .input('category', sql.NVarChar, questionData.category)
      .query(`
        INSERT INTO role_questions (role_id, question_text, weight, category)
        OUTPUT INSERTED.id, INSERTED.role_id as roleId, INSERTED.question_text as questionText,
               INSERTED.weight, INSERTED.category, INSERTED.is_active as isActive,
               INSERTED.created_at as createdAt
        VALUES (@roleId, @questionText, @weight, @category)
      `)
    
    return result.recordset[0] || null
  } catch (error) {
    console.error('Database error:', error)
    return null
  }
}

export async function deleteRoleQuestion(questionId: string): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('questionId', sql.UniqueIdentifier, questionId)
      .query(`
        UPDATE role_questions 
        SET is_active = 0
        WHERE id = @questionId
      `)
    
    return result.rowsAffected[0] > 0
  } catch (error) {
    console.error('Database error:', error)
    return false
  }
}