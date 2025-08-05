import sql from 'mssql'
import { getDbConnection } from './db-config'

export interface RoleRequirement {
  id: string
  roleId: string
  requirementText: string
  weight: number
  isRequired: boolean
  category: 'education' | 'experience' | 'other'
  createdAt: Date
}

export interface CreateRoleRequirement {
  roleId: string
  requirementText: string
  weight: number
  isRequired: boolean
  category: 'education' | 'experience' | 'other'
}

export async function createRoleRequirement(data: CreateRoleRequirement): Promise<RoleRequirement | null> {
  try {
    const { roleId, requirementText, weight, isRequired, category } = data
    const pool = await getDbConnection()
    
    const request = pool.request()
    request.input('roleId', sql.NVarChar(50), roleId)
    request.input('requirementText', sql.NVarChar(sql.MAX), requirementText)
    request.input('weight', sql.Int, weight)
    request.input('isRequired', sql.Bit, isRequired)
    request.input('category', sql.NVarChar(50), category)
    
    const result = await request.query(`
      INSERT INTO role_requirements (roleId, requirementText, weight, isRequired, category, createdAt)
      OUTPUT INSERTED.*
      VALUES (@roleId, @requirementText, @weight, @isRequired, @category, GETDATE())
    `)
    
    if (result.recordset.length > 0) {
      const record = result.recordset[0]
      return {
        id: record.id,
        roleId: record.roleId,
        requirementText: record.requirementText,
        weight: record.weight,
        isRequired: record.isRequired,
        category: record.category,
        createdAt: record.createdAt
      }
    }
    
    return null
  } catch (error) {
    console.error('Error creating role requirement:', error)
    throw error
  }
}

export async function getRoleRequirements(roleId: string): Promise<RoleRequirement[]> {
  try {
    const pool = await getDbConnection()
    const request = pool.request()
    request.input('roleId', sql.NVarChar(50), roleId)
    
    const result = await request.query(`
      SELECT id, roleId, requirementText, weight, isRequired, category, createdAt
      FROM role_requirements
      WHERE roleId = @roleId
      ORDER BY category, weight DESC, createdAt ASC
    `)
    
    return result.recordset.map(record => ({
      id: record.id,
      roleId: record.roleId,
      requirementText: record.requirementText,
      weight: record.weight,
      isRequired: record.isRequired,
      category: record.category,
      createdAt: record.createdAt
    }))
  } catch (error) {
    console.error('Error fetching role requirements:', error)
    throw error
  }
}

export async function updateRoleRequirement(
  id: string, 
  data: Partial<Omit<CreateRoleRequirement, 'roleId'>>
): Promise<RoleRequirement | null> {
  try {
    const pool = await getDbConnection()
    const request = pool.request()
    request.input('id', sql.NVarChar(50), id)
    
    const updateFields: string[] = []
    const allowedFields: (keyof typeof data)[] = ['requirementText', 'weight', 'isRequired', 'category']
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updateFields.push(`${field} = @${field}`)
        if (field === 'requirementText') {
          request.input(field, sql.NVarChar(sql.MAX), data[field])
        } else if (field === 'weight') {
          request.input(field, sql.Int, data[field])
        } else if (field === 'isRequired') {
          request.input(field, sql.Bit, data[field])
        } else if (field === 'category') {
          request.input(field, sql.NVarChar(50), data[field])
        }
      }
    })
    
    if (updateFields.length === 0) {
      throw new Error('No valid fields to update')
    }
    
    const result = await request.query(`
      UPDATE role_requirements
      SET ${updateFields.join(', ')}, updatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE id = @id
    `)
    
    if (result.recordset.length > 0) {
      const record = result.recordset[0]
      return {
        id: record.id,
        roleId: record.roleId,
        requirementText: record.requirementText,
        weight: record.weight,
        isRequired: record.isRequired,
        category: record.category,
        createdAt: record.createdAt
      }
    }
    
    return null
  } catch (error) {
    console.error('Error updating role requirement:', error)
    throw error
  }
}

export async function deleteRoleRequirement(id: string): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    const request = pool.request()
    request.input('id', sql.NVarChar(50), id)
    
    const result = await request.query(`
      DELETE FROM role_requirements
      WHERE id = @id
    `)
    
    return result.rowsAffected[0] > 0
  } catch (error) {
    console.error('Error deleting role requirement:', error)
    throw error
  }
}

export async function deleteRoleRequirementsByRoleId(roleId: string): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    const request = pool.request()
    request.input('roleId', sql.NVarChar(50), roleId)
    
    const result = await request.query(`
      DELETE FROM role_requirements
      WHERE roleId = @roleId
    `)
    
    return result.rowsAffected[0] >= 0 // Allow 0 if no requirements exist
  } catch (error) {
    console.error('Error deleting role requirements by role ID:', error)
    throw error
  }
}