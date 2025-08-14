import { NextRequest, NextResponse } from "next/server"
import { getDbConnection } from "@/lib/db-config"

const createFilesTable = `
CREATE TABLE files (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id NVARCHAR(255) NOT NULL,
    role_id UNIQUEIDENTIFIER NULL,
    original_filename NVARCHAR(255) NOT NULL,
    blob_filename NVARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type NVARCHAR(100) NOT NULL,
    blob_url NVARCHAR(1000) NOT NULL,
    upload_status NVARCHAR(50) DEFAULT 'pending',
    processing_status NVARCHAR(50) DEFAULT 'not_started',
    extracted_text NTEXT NULL,
    ai_analysis NTEXT NULL,
    ai_score DECIMAL(5,2) NULL,
    ai_decision NVARCHAR(50) NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    is_active BIT DEFAULT 1,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
);
`

const createUploadSessionsTable = `
CREATE TABLE upload_sessions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id NVARCHAR(255) NOT NULL,
    role_id UNIQUEIDENTIFIER NULL,
    session_token NVARCHAR(255) NOT NULL UNIQUE,
    total_files INT NOT NULL,
    uploaded_files INT DEFAULT 0,
    processed_files INT DEFAULT 0,
    failed_files INT DEFAULT 0,
    status NVARCHAR(50) DEFAULT 'active',
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    expires_at DATETIME2 NOT NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
);
`

const createFileUploadsTable = `
CREATE TABLE file_uploads (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    session_id UNIQUEIDENTIFIER NOT NULL,
    file_id UNIQUEIDENTIFIER NULL,
    filename NVARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    upload_progress DECIMAL(5,2) DEFAULT 0.00,
    status NVARCHAR(50) DEFAULT 'pending',
    error_message NTEXT NULL,
    blob_url NVARCHAR(1000) NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (session_id) REFERENCES upload_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
);
`

const createProcessingQueueTable = `
CREATE TABLE processing_queue (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    file_id UNIQUEIDENTIFIER NOT NULL,
    queue_type NVARCHAR(50) NOT NULL,
    priority INT DEFAULT 5,
    status NVARCHAR(50) DEFAULT 'pending',
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    error_message NTEXT NULL,
    scheduled_at DATETIME2 DEFAULT GETUTCDATE(),
    started_at DATETIME2 NULL,
    completed_at DATETIME2 NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);
`

const createIndexes = `
-- Files table indexes
CREATE INDEX IX_files_user_id ON files(user_id);
CREATE INDEX IX_files_role_id ON files(role_id);
CREATE INDEX IX_files_upload_status ON files(upload_status);
CREATE INDEX IX_files_processing_status ON files(processing_status);
CREATE INDEX IX_files_created_at ON files(created_at);

-- Upload sessions indexes
CREATE INDEX IX_upload_sessions_user_id ON upload_sessions(user_id);
CREATE INDEX IX_upload_sessions_token ON upload_sessions(session_token);
CREATE INDEX IX_upload_sessions_status ON upload_sessions(status);
CREATE INDEX IX_upload_sessions_expires_at ON upload_sessions(expires_at);

-- File uploads indexes
CREATE INDEX IX_file_uploads_session_id ON file_uploads(session_id);
CREATE INDEX IX_file_uploads_status ON file_uploads(status);

-- Processing queue indexes
CREATE INDEX IX_processing_queue_file_id ON processing_queue(file_id);
CREATE INDEX IX_processing_queue_status ON processing_queue(status);
CREATE INDEX IX_processing_queue_queue_type ON processing_queue(queue_type);
CREATE INDEX IX_processing_queue_priority ON processing_queue(priority, scheduled_at);
`

export async function POST(request: NextRequest) {
  try {
    console.log('Extending database schema for file uploads...')
    
    const pool = await getDbConnection()
    
    // Check if tables already exist
    const checkTables = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('files', 'upload_sessions', 'file_uploads', 'processing_queue')
    `)
    
    const existingTables = checkTables.recordset.map(row => row.TABLE_NAME)
    const requiredTables = ['files', 'upload_sessions', 'file_uploads', 'processing_queue']
    const missingTables = requiredTables.filter(table => !existingTables.includes(table))
    
    if (missingTables.length === 0) {
      await pool.close()
      return NextResponse.json({
        success: true,
        message: 'File upload tables already exist'
      })
    }
    
    // Create missing tables
    if (missingTables.includes('files')) {
      console.log('Creating files table...')
      await pool.request().query(createFilesTable)
    }
    
    if (missingTables.includes('upload_sessions')) {
      console.log('Creating upload_sessions table...')
      await pool.request().query(createUploadSessionsTable)
    }
    
    if (missingTables.includes('file_uploads')) {
      console.log('Creating file_uploads table...')
      await pool.request().query(createFileUploadsTable)
    }
    
    if (missingTables.includes('processing_queue')) {
      console.log('Creating processing_queue table...')
      await pool.request().query(createProcessingQueueTable)
    }
    
    console.log('Creating indexes...')
    await pool.request().query(createIndexes)
    
    console.log('File upload schema extension completed successfully!')
    
    return NextResponse.json({
      success: true,
      message: 'File upload tables created successfully',
      tablesCreated: missingTables
    })
    
  } catch (error) {
    console.error('File schema extension error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'File schema extension failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}