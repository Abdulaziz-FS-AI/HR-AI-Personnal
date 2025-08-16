import sql from 'mssql'
import { getDbConnection } from './db'

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
    request.input('roleId', sql.UniqueIdentifier, roleId)
    request.input('requirementType', sql.NVarChar(50), category || 'other')
    request.input('requirementValue', sql.NVarChar(sql.MAX), requirementText)
    request.input('isRequired', sql.Bit, isRequired)
    request.input('priority', sql.Int, weight)
    
    const result = await request.query(`
      INSERT INTO role_requirements (id, role_id, requirement_type, requirement_value, is_required, priority, created_at, updated_at)
      OUTPUT INSERTED.*
      VALUES (NEWID(), @roleId, @requirementType, @requirementValue, @isRequired, @priority, GETDATE(), GETDATE())
    `)
    
    if (result.recordset.length > 0) {
      const record = result.recordset[0]
      return {
        id: record.id,
        roleId: record.role_id,
        requirementText: record.requirement_value,
        weight: record.priority,
        isRequired: record.is_required,
        category: (record.requirement_type || 'other') as 'education' | 'experience' | 'other',
        createdAt: record.created_at
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
    request.input('roleId', sql.UniqueIdentifier, roleId)
    
    const result = await request.query(`
      SELECT id, role_id, requirement_type, requirement_value, is_required, priority, created_at
      FROM role_requirements
      WHERE role_id = @roleId
      ORDER BY requirement_type, priority DESC, created_at ASC
    `)
    
    return result.recordset.map(record => ({
      id: record.id,
      roleId: record.role_id,
      requirementText: record.requirement_value,
      weight: record.priority,
      isRequired: record.is_required,
      category: (record.requirement_type || 'other') as 'education' | 'experience' | 'other',
      createdAt: record.created_at
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
    request.input('id', sql.UniqueIdentifier, id)
    
    const updateFields: string[] = []
    
    if (data.requirementText !== undefined) {
      updateFields.push('requirement_value = @requirementValue')
      request.input('requirementValue', sql.NVarChar(sql.MAX), data.requirementText)
    }
    
    if (data.weight !== undefined) {
      updateFields.push('priority = @priority')
      request.input('priority', sql.Int, data.weight)
    }
    
    if (data.isRequired !== undefined) {
      updateFields.push('is_required = @isRequired')
      request.input('isRequired', sql.Bit, data.isRequired)
    }
    
    if (data.category !== undefined) {
      updateFields.push('requirement_type = @requirementType')
      request.input('requirementType', sql.NVarChar(50), data.category)
    }
    
    if (updateFields.length === 0) {
      throw new Error('No valid fields to update')
    }
    
    const result = await request.query(`
      UPDATE role_requirements
      SET ${updateFields.join(', ')}, updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE id = @id
    `)
    
    if (result.recordset.length > 0) {
      const record = result.recordset[0]
      return {
        id: record.id,
        roleId: record.role_id,
        requirementText: record.requirement_value,
        weight: record.priority,
        isRequired: record.is_required,
        category: (record.requirement_type || 'other') as 'education' | 'experience' | 'other',
        createdAt: record.created_at
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
    request.input('id', sql.UniqueIdentifier, id)
    
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
    request.input('roleId', sql.UniqueIdentifier, roleId)
    
    const result = await request.query(`
      DELETE FROM role_requirements
      WHERE role_id = @roleId
    `)
    
    return result.rowsAffected[0] >= 0 // Allow 0 if no requirements exist
  } catch (error) {
    console.error('Error deleting role requirements by role ID:', error)
    throw error
  }
}