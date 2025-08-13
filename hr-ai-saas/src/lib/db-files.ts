import sql from 'mssql'
import { getDbConnection } from './db'

// File-related interfaces
export interface FileRecord {
  id: string
  userId: string
  roleId: string | null
  originalFilename: string
  blobFilename: string
  fileSize: number
  mimeType: string
  blobUrl: string
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'failed'
  processingStatus: 'not_started' | 'extracting' | 'analyzing' | 'completed' | 'failed'
  extractedText: string | null
  aiAnalysis: string | null
  aiScore: number | null
  aiDecision: 'accept' | 'maybe' | 'reject' | null
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

export interface UploadSession {
  id: string
  userId: string
  roleId: string | null
  sessionToken: string
  totalFiles: number
  uploadedFiles: number
  processedFiles: number
  failedFiles: number
  status: 'active' | 'completed' | 'failed' | 'expired'
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
}

export interface BatchSession {
  id: string
  userId: string
  roleId: string | null
  sessionToken: string
  totalFiles: number
  totalProcessed: number
  totalFailed: number
  status: 'pending' | 'processing' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled'
  priority: 'low' | 'normal' | 'high'
  notificationEmail: string
  estimatedCompletionTime: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
}

export interface FileUpload {
  id: string
  sessionId: string
  fileId: string | null
  filename: string
  fileSize: number
  uploadProgress: number
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  errorMessage: string | null
  blobUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ProcessingQueueItem {
  id: string
  fileId: string
  queueType: 'file_processing' | 'ai_analysis' | 'results_aggregation'
  priority: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  retryCount: number
  maxRetries: number
  errorMessage: string | null
  scheduledAt: Date
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

// File operations
export async function createFile(fileData: Omit<FileRecord, 'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'extractedText' | 'aiAnalysis' | 'aiScore' | 'aiDecision'>): Promise<FileRecord | null> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, fileData.userId)
      .input('roleId', sql.UniqueIdentifier, fileData.roleId)
      .input('originalFilename', sql.NVarChar, fileData.originalFilename)
      .input('blobFilename', sql.NVarChar, fileData.blobFilename)
      .input('fileSize', sql.BigInt, fileData.fileSize)
      .input('mimeType', sql.NVarChar, fileData.mimeType)
      .input('blobUrl', sql.NVarChar, fileData.blobUrl)
      .input('uploadStatus', sql.NVarChar, fileData.uploadStatus)
      .input('processingStatus', sql.NVarChar, fileData.processingStatus)
      .query(`
        INSERT INTO files (user_id, role_id, original_filename, blob_filename, file_size, 
                          mime_type, blob_url, upload_status, processing_status)
        OUTPUT INSERTED.id, INSERTED.user_id as userId, INSERTED.role_id as roleId,
               INSERTED.original_filename as originalFilename, INSERTED.blob_filename as blobFilename,
               INSERTED.file_size as fileSize, INSERTED.mime_type as mimeType,
               INSERTED.blob_url as blobUrl, INSERTED.upload_status as uploadStatus,
               INSERTED.processing_status as processingStatus, INSERTED.extracted_text as extractedText,
               INSERTED.ai_analysis as aiAnalysis, INSERTED.ai_score as aiScore,
               INSERTED.ai_decision as aiDecision, INSERTED.created_at as createdAt,
               INSERTED.updated_at as updatedAt, INSERTED.is_active as isActive
        VALUES (@userId, @roleId, @originalFilename, @blobFilename, @fileSize,
                @mimeType, @blobUrl, @uploadStatus, @processingStatus)
      `)
    
    return result.recordset[0] || null
  } catch (error) {
    console.error('Database error creating file:', error)
    return null
  }
}

export async function updateFileStatus(fileId: string, updates: {
  uploadStatus?: FileRecord['uploadStatus']
  processingStatus?: FileRecord['processingStatus']
  extractedText?: string
  aiAnalysis?: string
  aiScore?: number
  aiDecision?: FileRecord['aiDecision']
}): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    
    const updateFields = []
    const request = pool.request()
      .input('fileId', sql.UniqueIdentifier, fileId)
      .input('updatedAt', sql.DateTime2, new Date())
    
    if (updates.uploadStatus) {
      updateFields.push('upload_status = @uploadStatus')
      request.input('uploadStatus', sql.NVarChar, updates.uploadStatus)
    }
    
    if (updates.processingStatus) {
      updateFields.push('processing_status = @processingStatus')
      request.input('processingStatus', sql.NVarChar, updates.processingStatus)
    }
    
    if (updates.extractedText !== undefined) {
      updateFields.push('extracted_text = @extractedText')
      request.input('extractedText', sql.NText, updates.extractedText)
    }
    
    if (updates.aiAnalysis !== undefined) {
      updateFields.push('ai_analysis = @aiAnalysis')
      request.input('aiAnalysis', sql.NText, updates.aiAnalysis)
    }
    
    if (updates.aiScore !== undefined) {
      updateFields.push('ai_score = @aiScore')
      request.input('aiScore', sql.Decimal(5, 2), updates.aiScore)
    }
    
    if (updates.aiDecision !== undefined) {
      updateFields.push('ai_decision = @aiDecision')
      request.input('aiDecision', sql.NVarChar, updates.aiDecision)
    }
    
    if (updateFields.length === 0) return false
    
    updateFields.push('updated_at = @updatedAt')
    
    const result = await request.query(`
      UPDATE files 
      SET ${updateFields.join(', ')}
      WHERE id = @fileId AND is_active = 1
    `)
    
    return result.rowsAffected[0] > 0
  } catch (error) {
    console.error('Database error updating file status:', error)
    return false
  }
}

export async function getFileById(fileId: string): Promise<FileRecord | null> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('fileId', sql.UniqueIdentifier, fileId)
      .query(`
        SELECT id, user_id as userId, role_id as roleId, original_filename as originalFilename,
               blob_filename as blobFilename, file_size as fileSize, mime_type as mimeType,
               blob_url as blobUrl, upload_status as uploadStatus, processing_status as processingStatus,
               extracted_text as extractedText, ai_analysis as aiAnalysis, ai_score as aiScore,
               ai_decision as aiDecision, created_at as createdAt, updated_at as updatedAt,
               is_active as isActive
        FROM files 
        WHERE id = @fileId AND is_active = 1
      `)
    
    return result.recordset[0] || null
  } catch (error) {
    console.error('Database error getting file:', error)
    return null
  }
}

export async function getFilesByUserId(userId: string, roleId?: string): Promise<FileRecord[]> {
  try {
    const pool = await getDbConnection()
    const request = pool.request()
      .input('userId', sql.UniqueIdentifier, userId)
    
    let query = `
      SELECT id, user_id as userId, role_id as roleId, original_filename as originalFilename,
             blob_filename as blobFilename, file_size as fileSize, mime_type as mimeType,
             blob_url as blobUrl, upload_status as uploadStatus, processing_status as processingStatus,
             extracted_text as extractedText, ai_analysis as aiAnalysis, ai_score as aiScore,
             ai_decision as aiDecision, created_at as createdAt, updated_at as updatedAt,
             is_active as isActive
      FROM files 
      WHERE user_id = @userId AND is_active = 1
    `
    
    if (roleId) {
      query += ' AND role_id = @roleId'
      request.input('roleId', sql.UniqueIdentifier, roleId)
    }
    
    query += ' ORDER BY created_at DESC'
    
    const result = await request.query(query)
    return result.recordset
  } catch (error) {
    console.error('Database error getting files by user:', error)
    return []
  }
}

// Upload session operations
export async function createUploadSession(sessionData: Omit<UploadSession, 'id' | 'uploadedFiles' | 'processedFiles' | 'failedFiles' | 'createdAt' | 'updatedAt'>): Promise<UploadSession | null> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('userId', sql.UniqueIdentifier, sessionData.userId)
      .input('roleId', sql.UniqueIdentifier, sessionData.roleId)
      .input('sessionToken', sql.NVarChar, sessionData.sessionToken)
      .input('totalFiles', sql.Int, sessionData.totalFiles)
      .input('status', sql.NVarChar, sessionData.status)
      .input('expiresAt', sql.DateTime2, sessionData.expiresAt)
      .query(`
        INSERT INTO upload_sessions (user_id, role_id, session_token, total_files, status, expires_at)
        OUTPUT INSERTED.id, INSERTED.user_id as userId, INSERTED.role_id as roleId,
               INSERTED.session_token as sessionToken, INSERTED.total_files as totalFiles,
               INSERTED.uploaded_files as uploadedFiles, INSERTED.processed_files as processedFiles,
               INSERTED.failed_files as failedFiles, INSERTED.status, INSERTED.created_at as createdAt,
               INSERTED.updated_at as updatedAt, INSERTED.expires_at as expiresAt
        VALUES (@userId, @roleId, @sessionToken, @totalFiles, @status, @expiresAt)
      `)
    
    return result.recordset[0] || null
  } catch (error) {
    console.error('Database error creating upload session:', error)
    return null
  }
}

export async function updateUploadSession(sessionId: string, updates: {
  uploadedFiles?: number
  processedFiles?: number
  failedFiles?: number
  status?: UploadSession['status']
}): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    
    const updateFields = []
    const request = pool.request()
      .input('sessionId', sql.UniqueIdentifier, sessionId)
      .input('updatedAt', sql.DateTime2, new Date())
    
    if (updates.uploadedFiles !== undefined) {
      updateFields.push('uploaded_files = @uploadedFiles')
      request.input('uploadedFiles', sql.Int, updates.uploadedFiles)
    }
    
    if (updates.processedFiles !== undefined) {
      updateFields.push('processed_files = @processedFiles')
      request.input('processedFiles', sql.Int, updates.processedFiles)
    }
    
    if (updates.failedFiles !== undefined) {
      updateFields.push('failed_files = @failedFiles')
      request.input('failedFiles', sql.Int, updates.failedFiles)
    }
    
    if (updates.status) {
      updateFields.push('status = @status')
      request.input('status', sql.NVarChar, updates.status)
    }
    
    if (updateFields.length === 0) return false
    
    updateFields.push('updated_at = @updatedAt')
    
    const result = await request.query(`
      UPDATE upload_sessions 
      SET ${updateFields.join(', ')}
      WHERE id = @sessionId
    `)
    
    return result.rowsAffected[0] > 0
  } catch (error) {
    console.error('Database error updating upload session:', error)
    return false
  }
}

export async function getUploadSession(sessionId: string): Promise<UploadSession | null> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('sessionId', sql.UniqueIdentifier, sessionId)
      .query(`
        SELECT id, user_id as userId, role_id as roleId, session_token as sessionToken,
               total_files as totalFiles, uploaded_files as uploadedFiles,
               processed_files as processedFiles, failed_files as failedFiles,
               status, created_at as createdAt, updated_at as updatedAt, expires_at as expiresAt
        FROM upload_sessions 
        WHERE id = @sessionId
      `)
    
    return result.recordset[0] || null
  } catch (error) {
    console.error('Database error getting upload session:', error)
    return null
  }
}

export async function getUploadSessionByToken(sessionToken: string): Promise<UploadSession | null> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('sessionToken', sql.NVarChar, sessionToken)
      .query(`
        SELECT id, user_id as userId, role_id as roleId, session_token as sessionToken,
               total_files as totalFiles, uploaded_files as uploadedFiles,
               processed_files as processedFiles, failed_files as failedFiles,
               status, created_at as createdAt, updated_at as updatedAt, expires_at as expiresAt
        FROM upload_sessions 
        WHERE session_token = @sessionToken
      `)
    
    return result.recordset[0] || null
  } catch (error) {
    console.error('Database error getting upload session by token:', error)
    return null
  }
}

// Processing queue operations
export async function addToProcessingQueue(queueData: Omit<ProcessingQueueItem, 'id' | 'retryCount' | 'errorMessage' | 'startedAt' | 'completedAt' | 'createdAt'>): Promise<ProcessingQueueItem | null> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('fileId', sql.UniqueIdentifier, queueData.fileId)
      .input('queueType', sql.NVarChar, queueData.queueType)
      .input('priority', sql.Int, queueData.priority)
      .input('status', sql.NVarChar, queueData.status)
      .input('maxRetries', sql.Int, queueData.maxRetries)
      .input('scheduledAt', sql.DateTime2, queueData.scheduledAt)
      .query(`
        INSERT INTO processing_queue (file_id, queue_type, priority, status, max_retries, scheduled_at)
        OUTPUT INSERTED.id, INSERTED.file_id as fileId, INSERTED.queue_type as queueType,
               INSERTED.priority, INSERTED.status, INSERTED.retry_count as retryCount,
               INSERTED.max_retries as maxRetries, INSERTED.error_message as errorMessage,
               INSERTED.scheduled_at as scheduledAt, INSERTED.started_at as startedAt,
               INSERTED.completed_at as completedAt, INSERTED.created_at as createdAt
        VALUES (@fileId, @queueType, @priority, @status, @maxRetries, @scheduledAt)
      `)
    
    return result.recordset[0] || null
  } catch (error) {
    console.error('Database error adding to processing queue:', error)
    return null
  }
}

export async function updateProcessingQueueItem(queueId: string, updates: {
  status?: ProcessingQueueItem['status']
  retryCount?: number
  errorMessage?: string
  startedAt?: Date
  completedAt?: Date
}): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    
    const updateFields = []
    const request = pool.request()
      .input('queueId', sql.UniqueIdentifier, queueId)
    
    if (updates.status) {
      updateFields.push('status = @status')
      request.input('status', sql.NVarChar, updates.status)
    }
    
    if (updates.retryCount !== undefined) {
      updateFields.push('retry_count = @retryCount')
      request.input('retryCount', sql.Int, updates.retryCount)
    }
    
    if (updates.errorMessage !== undefined) {
      updateFields.push('error_message = @errorMessage')
      request.input('errorMessage', sql.NText, updates.errorMessage)
    }
    
    if (updates.startedAt) {
      updateFields.push('started_at = @startedAt')
      request.input('startedAt', sql.DateTime2, updates.startedAt)
    }
    
    if (updates.completedAt) {
      updateFields.push('completed_at = @completedAt')
      request.input('completedAt', sql.DateTime2, updates.completedAt)
    }
    
    if (updateFields.length === 0) return false
    
    const result = await request.query(`
      UPDATE processing_queue 
      SET ${updateFields.join(', ')}
      WHERE id = @queueId
    `)
    
    return result.rowsAffected[0] > 0
  } catch (error) {
    console.error('Database error updating processing queue item:', error)
    return false
  }
}

export async function getSessionFiles(sessionId: string): Promise<FileRecord[]> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('sessionId', sql.UniqueIdentifier, sessionId)
      .query(`
        SELECT f.id, f.user_id as userId, f.role_id as roleId, f.original_filename as originalFilename,
               f.blob_filename as blobFilename, f.file_size as fileSize, f.mime_type as mimeType,
               f.blob_url as blobUrl, f.upload_status as uploadStatus, f.processing_status as processingStatus,
               f.extracted_text as extractedText, f.ai_analysis as aiAnalysis, f.ai_score as aiScore,
               f.ai_decision as aiDecision, f.created_at as createdAt, f.updated_at as updatedAt,
               f.is_active as isActive
        FROM files f
        INNER JOIN file_uploads fu ON f.id = fu.file_id
        WHERE fu.session_id = @sessionId AND f.is_active = 1
        ORDER BY f.created_at
      `)
    
    return result.recordset
  } catch (error) {
    console.error('Database error getting session files:', error)
    return []
  }
}

export async function getFilesByStatus(processingStatus: FileRecord['processingStatus'], limit?: number): Promise<FileRecord[]> {
  try {
    const pool = await getDbConnection()
    const request = pool.request()
      .input('processingStatus', sql.NVarChar, processingStatus)
    
    let query = `
      SELECT id, user_id as userId, role_id as roleId, original_filename as originalFilename,
             blob_filename as blobFilename, file_size as fileSize, mime_type as mimeType,
             blob_url as blobUrl, upload_status as uploadStatus, processing_status as processingStatus,
             extracted_text as extractedText, ai_analysis as aiAnalysis, ai_score as aiScore,
             ai_decision as aiDecision, created_at as createdAt, updated_at as updatedAt,
             is_active as isActive
      FROM files 
      WHERE processing_status = @processingStatus AND is_active = 1
      ORDER BY created_at ASC
    `
    
    if (limit) {
      query = `SELECT TOP (@limit) * FROM (${query}) AS subquery`
      request.input('limit', sql.Int, limit)
    }
    
    const result = await request.query(query)
    return result.recordset
  } catch (error) {
    console.error('Database error getting files by status:', error)
    return []
  }
}

// Bulk processing functions
export async function queueBulkProcessing(queueData: {
  sessionId: string
  userId: string
  roleId: string | null
  priority: number
  fileCount: number
  estimatedTimeMinutes: number
}): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    await pool.request()
      .input('sessionId', sql.UniqueIdentifier, queueData.sessionId)
      .input('userId', sql.UniqueIdentifier, queueData.userId)
      .input('roleId', sql.UniqueIdentifier, queueData.roleId)
      .input('queueType', sql.NVarChar, 'bulk_processing')
      .input('priority', sql.Int, queueData.priority)
      .input('fileCount', sql.Int, queueData.fileCount)
      .input('estimatedTimeMinutes', sql.Int, queueData.estimatedTimeMinutes)
      .input('scheduledAt', sql.DateTime2, new Date())
      .query(`
        INSERT INTO processing_queue (
          queue_type, priority, reference_id, user_id, role_id, 
          file_count, estimated_time_minutes, status, scheduled_at
        )
        VALUES (
          @queueType, @priority, @sessionId, @userId, @roleId,
          @fileCount, @estimatedTimeMinutes, 'pending', @scheduledAt
        )
      `)
    
    return true
  } catch (error) {
    console.error('Database error queuing bulk processing:', error)
    return false
  }
}

export async function getBatchSession(sessionId: string): Promise<BatchSession | null> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('sessionId', sql.UniqueIdentifier, sessionId)
      .query(`
        SELECT id, user_id as userId, role_id as roleId, session_token as sessionToken,
               total_files as totalFiles, total_processed as totalProcessed,
               total_failed as totalFailed, status, priority,
               notification_email as notificationEmail,
               estimated_completion_time as estimatedCompletionTime,
               completed_at as completedAt, created_at as createdAt,
               updated_at as updatedAt, expires_at as expiresAt
        FROM batch_sessions 
        WHERE id = @sessionId
      `)
    
    return result.recordset[0] || null
  } catch (error) {
    console.error('Database error getting batch session:', error)
    return null
  }
}

export async function getBatchSessionFiles(sessionId: string): Promise<FileRecord[]> {
  try {
    const pool = await getDbConnection()
    const result = await pool.request()
      .input('sessionId', sql.UniqueIdentifier, sessionId)
      .query(`
        SELECT id, user_id as userId, role_id as roleId, original_filename as originalFilename,
               blob_filename as blobFilename, file_size as fileSize, mime_type as mimeType,
               blob_url as blobUrl, upload_status as uploadStatus, processing_status as processingStatus,
               extracted_text as extractedText, ai_analysis as aiAnalysis, ai_score as aiScore,
               ai_decision as aiDecision, created_at as createdAt, updated_at as updatedAt,
               is_active as isActive, processing_order as processingOrder
        FROM files
        WHERE session_id = @sessionId AND is_active = 1
        ORDER BY processing_order ASC, created_at ASC
      `)
    
    return result.recordset
  } catch (error) {
    console.error('Database error getting batch session files:', error)
    return []
  }
}

export async function updateBatchProgress(sessionId: string, updates: {
  totalProcessed?: number
  totalFailed?: number
  status?: BatchSession['status']
  completedAt?: Date
}): Promise<boolean> {
  try {
    const pool = await getDbConnection()
    
    const updateFields = []
    const request = pool.request()
      .input('sessionId', sql.UniqueIdentifier, sessionId)
      .input('updatedAt', sql.DateTime2, new Date())
    
    if (updates.totalProcessed !== undefined) {
      updateFields.push('total_processed = @totalProcessed')
      request.input('totalProcessed', sql.Int, updates.totalProcessed)
    }
    
    if (updates.totalFailed !== undefined) {
      updateFields.push('total_failed = @totalFailed')
      request.input('totalFailed', sql.Int, updates.totalFailed)
    }
    
    if (updates.status) {
      updateFields.push('status = @status')
      request.input('status', sql.NVarChar, updates.status)
    }
    
    if (updates.completedAt) {
      updateFields.push('completed_at = @completedAt')
      request.input('completedAt', sql.DateTime2, updates.completedAt)
    }
    
    if (updateFields.length === 0) return true
    
    updateFields.push('updated_at = @updatedAt')
    
    const query = `
      UPDATE batch_sessions 
      SET ${updateFields.join(', ')}
      WHERE id = @sessionId
    `
    
    await request.query(query)
    return true
  } catch (error) {
    console.error('Database error updating batch progress:', error)
    return false
  }
}