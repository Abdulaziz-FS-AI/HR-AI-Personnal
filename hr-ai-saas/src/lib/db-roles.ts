import sql from 'mssql'
import { getDbConnection } from './db'

export interface Role {
  id: string
  userId: string
  title: string
  department?: string
  location?: string
  employmentType: string
  minExperience?: number
  maxExperience?: number
  salaryMin?: number
  salaryMax?: number
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface RoleSkill {
  id: string
  roleId: string
  skillName: string
  description?: string
  weight: number
  isRequired: boolean
  createdAt: string
  updatedAt: string
}

export interface RoleQuestion {
  id: string
  roleId: string
  question: string
  expectedAnswer: string
  weight: number
  orderIndex: number
  createdAt: string
  updatedAt: string
}

export async function getRoleById(roleId: string): Promise<Role | null> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, roleId)
      .query(`
        SELECT 
          id,
          user_id as userId,
          title,
          department,
          location,
          employment_type as employmentType,
          min_experience_years as minExperience,
          max_experience_years as maxExperience,
          description,
          is_active as isActive,
          created_at as createdAt,
          updated_at as updatedAt
        FROM roles
        WHERE id = @roleId AND is_active = 1
      `)
    
    return result.recordset[0] || null
  } catch (error) {
    console.error('Error fetching role:', error)
    throw error
  }
}

export async function getRolesByUserId(userId: string): Promise<Role[]> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT 
          id,
          user_id as userId,
          title,
          department,
          location,
          employment_type as employmentType,
          min_experience_years as minExperience,
          max_experience_years as maxExperience,
          description,
          is_active as isActive,
          created_at as createdAt,
          updated_at as updatedAt
        FROM roles
        WHERE user_id = @userId AND is_active = 1
        ORDER BY created_at DESC
      `)
    
    return result.recordset
  } catch (error) {
    console.error('Error fetching roles:', error)
    throw error
  }
}

export async function getRoleSkills(roleId: string): Promise<RoleSkill[]> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, roleId)
      .query(`
        SELECT 
          id,
          role_id as roleId,
          skill_name as skillName,
          skill_category as description,
          weight,
          is_required as isRequired,
          created_at as createdAt
        FROM role_skills
        WHERE role_id = @roleId
        ORDER BY weight DESC
      `)
    
    return result.recordset
  } catch (error) {
    console.error('Error fetching role skills:', error)
    throw error
  }
}

export async function getRoleQuestions(roleId: string): Promise<RoleQuestion[]> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, roleId)
      .query(`
        SELECT 
          id,
          role_id as roleId,
          question_text as question,
          '' as expectedAnswer,
          weight,
          1 as orderIndex,
          created_at as createdAt
        FROM role_questions
        WHERE role_id = @roleId
        ORDER BY order_index ASC
      `)
    
    return result.recordset
  } catch (error) {
    console.error('Error fetching role questions:', error)
    throw error
  }
}

export async function createRole(data: {
  userId: string
  title: string
  department?: string
  location?: string
  employmentType: string
  minExperience?: number
  maxExperience?: number
  salaryMin?: number
  salaryMax?: number
  description?: string
}): Promise<Role> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('userId', sql.NVarChar, data.userId)
      .input('title', sql.NVarChar, data.title)
      .input('department', sql.NVarChar, data.department || null)
      .input('location', sql.NVarChar, data.location || null)
      .input('employmentType', sql.NVarChar, data.employmentType)
      .input('minExperience', sql.Int, data.minExperience || null)
      .input('maxExperience', sql.Int, data.maxExperience || null)
      .input('salaryMin', sql.Decimal(10, 2), data.salaryMin || null)
      .input('salaryMax', sql.Decimal(10, 2), data.salaryMax || null)
      .input('description', sql.NText, data.description || null)
      .query(`
        INSERT INTO roles (
          user_id, title, department, location, employment_type,
          min_experience_years, max_experience_years, salary_min, salary_max, description
        )
        OUTPUT inserted.id, inserted.user_id as userId, inserted.title, 
               inserted.department, inserted.location, inserted.employment_type as employmentType,
               inserted.min_experience_years as minExperience, inserted.max_experience_years as maxExperience,
               inserted.salary_min as salaryMin, inserted.salary_max as salaryMax,
               inserted.description, inserted.is_active as isActive,
               inserted.created_at as createdAt, inserted.updated_at as updatedAt
        VALUES (
          @userId, @title, @department, @location, @employmentType,
          @minExperience, @maxExperience, @salaryMin, @salaryMax, @description
        )
      `)
    
    return result.recordset[0]
  } catch (error) {
    console.error('Error creating role:', error)
    throw error
  }
}

export async function updateRole(roleId: string, data: Partial<Omit<Role, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    const updateFields = []
    const request = pool.request()
      .input('roleId', sql.UniqueIdentifier, roleId)

    if (data.title !== undefined) {
      updateFields.push('title = @title')
      request.input('title', sql.NVarChar, data.title)
    }
    if (data.department !== undefined) {
      updateFields.push('department = @department')
      request.input('department', sql.NVarChar, data.department)
    }
    if (data.location !== undefined) {
      updateFields.push('location = @location')
      request.input('location', sql.NVarChar, data.location)
    }
    if (data.employmentType !== undefined) {
      updateFields.push('employment_type = @employmentType')
      request.input('employmentType', sql.NVarChar, data.employmentType)
    }
    if (data.minExperience !== undefined) {
      updateFields.push('min_experience_years = @minExperience')
      request.input('minExperience', sql.Int, data.minExperience)
    }
    if (data.maxExperience !== undefined) {
      updateFields.push('max_experience_years = @maxExperience')
      request.input('maxExperience', sql.Int, data.maxExperience)
    }
    if (data.salaryMin !== undefined) {
      updateFields.push('salary_min = @salaryMin')
      request.input('salaryMin', sql.Decimal(10, 2), data.salaryMin)
    }
    if (data.salaryMax !== undefined) {
      updateFields.push('salary_max = @salaryMax')
      request.input('salaryMax', sql.Decimal(10, 2), data.salaryMax)
    }
    if (data.description !== undefined) {
      updateFields.push('description = @description')
      request.input('description', sql.NText, data.description)
    }
    if (data.isActive !== undefined) {
      updateFields.push('is_active = @isActive')
      request.input('isActive', sql.Bit, data.isActive)
    }

    if (updateFields.length === 0) {
      return false
    }

    updateFields.push('updated_at = GETUTCDATE()')

    const result = await request.query(`
      UPDATE roles
      SET ${updateFields.join(', ')}
      WHERE id = @roleId
    `)

    return result.rowsAffected[0] > 0
  } catch (error) {
    console.error('Error updating role:', error)
    throw error
  }
}

export async function deleteRole(roleId: string): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, roleId)
      .query(`
        UPDATE roles
        SET is_active = 0, updated_at = GETUTCDATE()
        WHERE id = @roleId
      `)
    
    return result.rowsAffected[0] > 0
  } catch (error) {
    console.error('Error deleting role:', error)
    throw error
  }
}

export async function createRoleSkill(data: {
  roleId: string
  skillName: string
  weight: number
  isRequired: boolean
  skillCategory?: string | null
}): Promise<RoleSkill> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, data.roleId)
      .input('skillName', sql.NVarChar, data.skillName)
      .input('weight', sql.Int, data.weight)
      .input('isRequired', sql.Bit, data.isRequired)
      .input('skillCategory', sql.NVarChar, data.skillCategory || null)
      .query(`
        INSERT INTO role_skills (
          role_id, skill_name, weight, is_required, skill_category
        )
        OUTPUT inserted.id, inserted.role_id as roleId, inserted.skill_name as skillName,
               inserted.weight, inserted.is_required as isRequired, 
               inserted.skill_category as skillCategory,
               inserted.created_at as createdAt, inserted.updated_at as updatedAt
        VALUES (
          @roleId, @skillName, @weight, @isRequired, @skillCategory
        )
      `)
    
    return result.recordset[0]
  } catch (error) {
    console.error('Error creating role skill:', error)
    throw error
  }
}

export async function deleteRoleSkill(skillId: string): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('skillId', sql.UniqueIdentifier, skillId)
      .query(`
        DELETE FROM role_skills
        WHERE id = @skillId
      `)
    
    return result.rowsAffected[0] > 0
  } catch (error) {
    console.error('Error deleting role skill:', error)
    throw error
  }
}

export async function createRoleQuestion(data: {
  roleId: string
  questionText: string
  weight: number
  category?: string | null
}): Promise<RoleQuestion> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('roleId', sql.UniqueIdentifier, data.roleId)
      .input('questionText', sql.NVarChar, data.questionText)
      .input('weight', sql.Int, data.weight)
      .input('category', sql.NVarChar, data.category || null)
      .query(`
        INSERT INTO role_questions (
          role_id, question_text, weight, category
        )
        OUTPUT inserted.id, inserted.role_id as roleId, 
               inserted.question_text as questionText,
               inserted.weight, inserted.category,
               inserted.created_at as createdAt, inserted.updated_at as updatedAt
        VALUES (
          @roleId, @questionText, @weight, @category
        )
      `)
    
    return result.recordset[0]
  } catch (error) {
    console.error('Error creating role question:', error)
    throw error
  }
}

export async function deleteRoleQuestion(questionId: string): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('questionId', sql.UniqueIdentifier, questionId)
      .query(`
        DELETE FROM role_questions
        WHERE id = @questionId
      `)
    
    return result.rowsAffected[0] > 0
  } catch (error) {
    console.error('Error deleting role question:', error)
    throw error
  }
}