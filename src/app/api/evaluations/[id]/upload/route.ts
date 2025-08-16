/**
 * EVALUATION FILE UPLOAD ENDPOINT
 * 
 * Simplified file upload for evaluations that stores files locally
 * until Azure Blob Storage is properly configured
 */

import { NextRequest, NextResponse } from 'next/server'
import sql from 'mssql'
import { getDatabaseConfig } from '@/lib/db-config-vercel'
import { resolveUserContext } from '@/lib/auth/user-resolver'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

// Global connection pool for serverless
let globalPool: sql.ConnectionPool | undefined

async function getConnection(): Promise<sql.ConnectionPool> {
  if (globalPool?.connected) {
    return globalPool
  }

  const dbConfig = getDatabaseConfig()
  
  if (!dbConfig.server || !dbConfig.database || !dbConfig.user || !dbConfig.password) {
    throw new Error('Database configuration missing')
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: evaluationId } = await params
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(evaluationId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid evaluation ID format'
      }, { status: 400 })
    }

    const pool = await getConnection()
    
    // Get user context
    const userContext = await resolveUserContext(request)
    const userId = userContext.userId
    
    // Verify evaluation ownership
    const evaluationResult = await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .input('userId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT id, name, status
        FROM evaluation_sessions
        WHERE id = @evaluationId AND user_id = @userId
      `)
    
    if (evaluationResult.recordset.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Evaluation not found or access denied'
      }, { status: 404 })
    }
    
    const evaluation = evaluationResult.recordset[0]
    
    // Parse multipart form data
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    
    if (files.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No files provided'
      }, { status: 400 })
    }
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads', evaluationId)
    try {
      await mkdir(uploadsDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }
    
    const uploadedFiles = []
    
    for (const file of files) {
      try {
        // Validate file
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          continue // Skip non-PDF files
        }
        
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          continue // Skip files too large
        }
        
        // Generate unique filename
        const fileId = randomUUID()
        const fileName = `${fileId}.pdf`
        const filePath = join(uploadsDir, fileName)
        
        // Save file to disk
        const buffer = Buffer.from(await file.arrayBuffer())
        await writeFile(filePath, buffer)
        
        // Save file record to database
        await pool.request()
          .input('id', sql.UniqueIdentifier, fileId)
          .input('evaluationId', sql.UniqueIdentifier, evaluationId)
          .input('fileName', sql.NVarChar, file.name)
          .input('blobName', sql.NVarChar, fileName)
          .input('fileSize', sql.BigInt, file.size)
          .input('filePath', sql.NVarChar, filePath)
          .query(`
            INSERT INTO evaluation_files (
              id, evaluation_id, file_name, blob_name, file_size, 
              status, created_at, updated_at
            )
            VALUES (
              @id, @evaluationId, @fileName, @blobName, @fileSize,
              'uploaded', GETDATE(), GETDATE()
            )
          `)
        
        uploadedFiles.push({
          id: fileId,
          fileName: file.name,
          size: file.size
        })
        
      } catch (fileError) {
        console.error(`Failed to upload ${file.name}:`, fileError)
      }
    }
    
    // Update evaluation file count
    await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .input('totalFiles', sql.Int, uploadedFiles.length)
      .query(`
        UPDATE evaluation_sessions 
        SET total_files = @totalFiles, updated_at = GETDATE()
        WHERE id = @evaluationId
      `)
    
    return NextResponse.json({
      success: true,
      message: `Uploaded ${uploadedFiles.length} files`,
      data: {
        evaluationId,
        uploadedFiles,
        totalFiles: uploadedFiles.length
      }
    })
    
  } catch (error) {
    console.error('File upload error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'File upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}