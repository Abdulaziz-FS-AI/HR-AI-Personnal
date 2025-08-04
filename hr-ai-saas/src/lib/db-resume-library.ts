import sql from 'mssql'
import { getServerConfig } from './db-config'

// Enhanced interfaces for Resume Library
export interface ResumeFile {
  id: string
  fileName: string
  fileSize: number
  fileType: string
  blobName?: string
  userId: string
  uploadedAt: Date
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed'
  extractedText?: string
  isArchived: boolean
  isDeleted: boolean
  tags?: string
  notes?: string
  retryCount: number
  lastRetryAt?: Date
  archivedAt?: Date
  deletedAt?: Date
  extractionConfidence: number
  notesCount?: number
  tagList?: string
}

export interface FileNote {
  id: string
  fileId: string
  userId: string
  noteText: string
  createdAt: Date
  updatedAt: Date
}

export interface FileTag {
  id: string
  fileId: string
  tagName: string
  createdAt: Date
  createdBy: string
}

export interface FileFilters {
  status?: 'all' | 'ready' | 'processing' | 'failed'
  archived?: boolean
  dateRange?: {
    start: Date
    end: Date
  }
  tags?: string[]
  search?: string
}

/**
 * Get all resume files for a user with optional filtering
 */
export async function getResumeFiles(
  userId: string, 
  filters?: FileFilters,
  limit: number = 50,
  offset: number = 0
): Promise<ResumeFile[]> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    const request = pool.request()
      .input('userId', sql.NVarChar, userId)
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)

    let whereClause = 'WHERE user_id = @userId AND is_deleted = 0'
    
    if (filters?.archived !== undefined) {
      whereClause += ' AND is_archived = @isArchived'
      request.input('isArchived', sql.Bit, filters.archived)
    }
    
    if (filters?.status && filters.status !== 'all') {
      if (filters.status === 'ready') {
        whereClause += ' AND processing_status = @status'
        request.input('status', sql.NVarChar, 'completed')
      } else if (filters.status === 'processing') {
        whereClause += ' AND processing_status IN (@status1, @status2)'
        request.input('status1', sql.NVarChar, 'pending')
        request.input('status2', sql.NVarChar, 'processing')
      } else {
        whereClause += ' AND processing_status = @status'
        request.input('status', sql.NVarChar, filters.status)
      }
    }
    
    if (filters?.search) {
      whereClause += ' AND (file_name LIKE @search OR extracted_text LIKE @search OR tags LIKE @search)'
      request.input('search', sql.NVarChar, `%${filters.search}%`)
    }
    
    if (filters?.dateRange) {
      whereClause += ' AND uploaded_at BETWEEN @startDate AND @endDate'
      request.input('startDate', sql.DateTime2, filters.dateRange.start)
      request.input('endDate', sql.DateTime2, filters.dateRange.end)
    }

    const query = `
      SELECT * FROM vw_file_details
      ${whereClause}
      ORDER BY uploaded_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `

    const result = await request.query(query)
    
    return result.recordset.map(row => ({
      id: row.id,
      fileName: row.file_name,
      fileSize: row.file_size,
      fileType: row.file_type,
      blobName: row.blob_name,
      userId: row.user_id,
      uploadedAt: row.uploaded_at,
      processingStatus: row.processing_status,
      extractedText: row.extracted_text,
      isArchived: row.is_archived,
      isDeleted: row.is_deleted,
      tags: row.tags,
      notes: row.notes,
      retryCount: row.retry_count || 0,
      lastRetryAt: row.last_retry_at,
      archivedAt: row.archived_at,
      deletedAt: row.deleted_at,
      extractionConfidence: row.extraction_confidence || 0,
      notesCount: row.notes_count || 0,
      tagList: row.tag_list
    }))
  } finally {
    await pool.close()
  }
}

/**
 * Get a single resume file by ID
 */
export async function getResumeFileById(fileId: string, userId: string): Promise<ResumeFile | null> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    const result = await pool.request()
      .input('fileId', sql.NVarChar, fileId)
      .input('userId', sql.NVarChar, userId)
      .query(`
        SELECT * FROM vw_file_details
        WHERE id = @fileId AND user_id = @userId AND is_deleted = 0
      `)

    if (result.recordset.length === 0) {
      return null
    }

    const row = result.recordset[0]
    return {
      id: row.id,
      fileName: row.file_name,
      fileSize: row.file_size,
      fileType: row.file_type,
      blobName: row.blob_name,
      userId: row.user_id,
      uploadedAt: row.uploaded_at,
      processingStatus: row.processing_status,
      extractedText: row.extracted_text,
      isArchived: row.is_archived,
      isDeleted: row.is_deleted,
      tags: row.tags,
      notes: row.notes,
      retryCount: row.retry_count || 0,
      lastRetryAt: row.last_retry_at,
      archivedAt: row.archived_at,
      deletedAt: row.deleted_at,
      extractionConfidence: row.extraction_confidence || 0,
      notesCount: row.notes_count || 0,
      tagList: row.tag_list
    }
  } finally {
    await pool.close()
  }
}

/**
 * Archive/unarchive a file
 */
export async function archiveResumeFile(fileId: string, userId: string, archive: boolean = true): Promise<boolean> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    const result = await pool.request()
      .input('fileId', sql.NVarChar, fileId)
      .input('userId', sql.NVarChar, userId)
      .input('isArchived', sql.Bit, archive)
      .input('archivedAt', sql.DateTime2, archive ? new Date() : null)
      .query(`
        UPDATE files 
        SET is_archived = @isArchived,
            archived_at = @archivedAt,
            updated_at = GETDATE()
        WHERE id = @fileId AND user_id = @userId AND is_deleted = 0
      `)

    return result.rowsAffected[0] > 0
  } finally {
    await pool.close()
  }
}

/**
 * Soft delete a file
 */
export async function deleteResumeFile(fileId: string, userId: string): Promise<boolean> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    const result = await pool.request()
      .input('fileId', sql.NVarChar, fileId)
      .input('userId', sql.NVarChar, userId)
      .input('deletedAt', sql.DateTime2, new Date())
      .query(`
        UPDATE files 
        SET is_deleted = 1,
            deleted_at = @deletedAt,
            updated_at = GETDATE()
        WHERE id = @fileId AND user_id = @userId
      `)

    return result.rowsAffected[0] > 0
  } finally {
    await pool.close()
  }
}

/**
 * Add tags to a file
 */
export async function addFileTag(fileId: string, tagName: string, userId: string): Promise<string | null> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    // Check if tag already exists for this file
    const existingTag = await pool.request()
      .input('fileId', sql.NVarChar, fileId)
      .input('tagName', sql.NVarChar, tagName)
      .query(`
        SELECT id FROM file_tags 
        WHERE file_id = @fileId AND tag_name = @tagName
      `)

    if (existingTag.recordset.length > 0) {
      return existingTag.recordset[0].id
    }

    // Create new tag
    const result = await pool.request()
      .input('fileId', sql.NVarChar, fileId)
      .input('tagName', sql.NVarChar, tagName)
      .input('createdBy', sql.NVarChar, userId)
      .query(`
        INSERT INTO file_tags (file_id, tag_name, created_by)
        OUTPUT INSERTED.id
        VALUES (@fileId, @tagName, @createdBy)
      `)

    return result.recordset[0]?.id || null
  } finally {
    await pool.close()
  }
}

/**
 * Remove tag from file
 */
export async function removeFileTag(fileId: string, tagName: string): Promise<boolean> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    const result = await pool.request()
      .input('fileId', sql.NVarChar, fileId)
      .input('tagName', sql.NVarChar, tagName)
      .query(`
        DELETE FROM file_tags 
        WHERE file_id = @fileId AND tag_name = @tagName
      `)

    return result.rowsAffected[0] > 0
  } finally {
    await pool.close()
  }
}

/**
 * Add note to file
 */
export async function addFileNote(fileId: string, userId: string, noteText: string): Promise<string | null> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    const result = await pool.request()
      .input('fileId', sql.NVarChar, fileId)
      .input('userId', sql.NVarChar, userId)
      .input('noteText', sql.NText, noteText)
      .query(`
        INSERT INTO file_notes (file_id, user_id, note_text)
        OUTPUT INSERTED.id
        VALUES (@fileId, @userId, @noteText)
      `)

    return result.recordset[0]?.id || null
  } finally {
    await pool.close()
  }
}

/**
 * Update file note
 */
export async function updateFileNote(noteId: string, userId: string, noteText: string): Promise<boolean> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    const result = await pool.request()
      .input('noteId', sql.NVarChar, noteId)
      .input('userId', sql.NVarChar, userId)
      .input('noteText', sql.NText, noteText)
      .query(`
        UPDATE file_notes 
        SET note_text = @noteText, updated_at = GETDATE()
        WHERE id = @noteId AND user_id = @userId
      `)

    return result.rowsAffected[0] > 0
  } finally {
    await pool.close()
  }
}

/**
 * Delete file note
 */
export async function deleteFileNote(noteId: string, userId: string): Promise<boolean> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    const result = await pool.request()
      .input('noteId', sql.NVarChar, noteId)
      .input('userId', sql.NVarChar, userId)
      .query(`
        DELETE FROM file_notes 
        WHERE id = @noteId AND user_id = @userId
      `)

    return result.rowsAffected[0] > 0
  } finally {
    await pool.close()
  }
}

/**
 * Get all notes for a file
 */
export async function getFileNotes(fileId: string): Promise<FileNote[]> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    const result = await pool.request()
      .input('fileId', sql.NVarChar, fileId)
      .query(`
        SELECT id, file_id as fileId, user_id as userId, note_text as noteText,
               created_at as createdAt, updated_at as updatedAt
        FROM file_notes 
        WHERE file_id = @fileId
        ORDER BY created_at DESC
      `)

    return result.recordset
  } finally {
    await pool.close()
  }
}

/**
 * Reprocess file (retry text extraction)
 */
export async function reprocessFile(fileId: string, userId: string): Promise<boolean> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    const result = await pool.request()
      .input('fileId', sql.NVarChar, fileId)
      .input('userId', sql.NVarChar, userId)
      .query(`
        UPDATE files 
        SET processing_status = 'pending',
            retry_count = retry_count + 1,
            last_retry_at = GETDATE(),
            updated_at = GETDATE()
        WHERE id = @fileId AND user_id = @userId AND is_deleted = 0
      `)

    return result.rowsAffected[0] > 0
  } finally {
    await pool.close()
  }
}

/**
 * Update extraction confidence
 */
export async function updateExtractionConfidence(fileId: string, confidence: number): Promise<boolean> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    const result = await pool.request()
      .input('fileId', sql.NVarChar, fileId)
      .input('confidence', sql.Int, confidence)
      .query(`
        UPDATE files 
        SET extraction_confidence = @confidence,
            updated_at = GETDATE()
        WHERE id = @fileId
      `)

    return result.rowsAffected[0] > 0
  } finally {
    await pool.close()
  }
}

/**
 * Get files ready for analysis (completed extraction)
 */
export async function getFilesReadyForAnalysis(userId: string): Promise<ResumeFile[]> {
  return getResumeFiles(userId, { 
    status: 'ready', 
    archived: false 
  })
}

/**
 * Bulk archive files
 */
export async function bulkArchiveFiles(fileIds: string[], userId: string): Promise<number> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    const fileIdList = fileIds.map(id => `'${id}'`).join(',')
    
    const result = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(`
        UPDATE files 
        SET is_archived = 1,
            archived_at = GETDATE(),
            updated_at = GETDATE()
        WHERE id IN (${fileIdList}) AND user_id = @userId AND is_deleted = 0
      `)

    return result.rowsAffected[0] || 0
  } finally {
    await pool.close()
  }
}

/**
 * Bulk delete files
 */
export async function bulkDeleteFiles(fileIds: string[], userId: string): Promise<number> {
  const config = getServerConfig()
  const pool = await sql.connect(config)

  try {
    const fileIdList = fileIds.map(id => `'${id}'`).join(',')
    
    const result = await pool.request()
      .input('userId', sql.NVarChar, userId)
      .query(`
        UPDATE files 
        SET is_deleted = 1,
            deleted_at = GETDATE(),
            updated_at = GETDATE()
        WHERE id IN (${fileIdList}) AND user_id = @userId
      `)

    return result.rowsAffected[0] || 0
  } finally {
    await pool.close()
  }
}