import { NextRequest, NextResponse } from 'next/server'
import sql from 'mssql'
import { getServerConfig } from '@/lib/db-config'

export async function POST(request: NextRequest) {
  try {
    console.log('Extending files schema for Resume Library features...')
    
    const config = getServerConfig()
    const pool = await sql.connect(config)

    // Add new columns to files table
    await pool.request().query(`
      -- Check and add columns if they don't exist
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('files') AND name = 'is_archived')
      ALTER TABLE files ADD is_archived BIT DEFAULT 0;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('files') AND name = 'is_deleted')
      ALTER TABLE files ADD is_deleted BIT DEFAULT 0;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('files') AND name = 'tags')
      ALTER TABLE files ADD tags NVARCHAR(500) NULL;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('files') AND name = 'notes')
      ALTER TABLE files ADD notes NTEXT NULL;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('files') AND name = 'retry_count')
      ALTER TABLE files ADD retry_count INT DEFAULT 0;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('files') AND name = 'last_retry_at')
      ALTER TABLE files ADD last_retry_at DATETIME2 NULL;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('files') AND name = 'archived_at')
      ALTER TABLE files ADD archived_at DATETIME2 NULL;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('files') AND name = 'deleted_at')
      ALTER TABLE files ADD deleted_at DATETIME2 NULL;

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('files') AND name = 'extraction_confidence')
      ALTER TABLE files ADD extraction_confidence INT DEFAULT 0;
    `)

    // Create file_notes table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='file_notes' AND xtype='U')
      CREATE TABLE file_notes (
        id NVARCHAR(255) PRIMARY KEY DEFAULT NEWID(),
        file_id NVARCHAR(255) NOT NULL,
        user_id NVARCHAR(255) NOT NULL,
        note_text NTEXT NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
      )
    `)

    // Create file_tags table for normalized tag storage
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='file_tags' AND xtype='U')
      CREATE TABLE file_tags (
        id NVARCHAR(255) PRIMARY KEY DEFAULT NEWID(),
        file_id NVARCHAR(255) NOT NULL,
        tag_name NVARCHAR(100) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        created_by NVARCHAR(255) NOT NULL
      )
    `)

    // Create indexes for better performance
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_files_archived')
      CREATE INDEX IX_files_archived ON files(is_archived);

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_files_deleted')
      CREATE INDEX IX_files_deleted ON files(is_deleted);

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_file_notes_file_id')
      CREATE INDEX IX_file_notes_file_id ON file_notes(file_id);

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_file_tags_file_id')
      CREATE INDEX IX_file_tags_file_id ON file_tags(file_id);

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_file_tags_name')
      CREATE INDEX IX_file_tags_name ON file_tags(tag_name);
    `)

    // Create view for complete file information
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_file_details')
      DROP VIEW vw_file_details
    `)

    await pool.request().query(`
      CREATE VIEW vw_file_details AS
      SELECT 
        f.id,
        f.original_filename as file_name,
        f.file_size,
        f.mime_type as file_type,
        f.blob_filename as blob_name,
        f.user_id,
        f.blob_url,
        f.created_at as uploaded_at,
        f.processing_status,
        f.extracted_text,
        f.is_archived,
        f.is_deleted,
        f.tags,
        f.notes,
        f.retry_count,
        f.last_retry_at,
        f.archived_at,
        f.deleted_at,
        f.extraction_confidence,
        (
          SELECT COUNT(*) 
          FROM file_notes fn 
          WHERE fn.file_id = f.id
        ) as notes_count,
        (
          SELECT STRING_AGG(ft.tag_name, ',') 
          FROM file_tags ft 
          WHERE ft.file_id = f.id
        ) as tag_list
      FROM files f
      WHERE f.is_deleted = 0
    `)

    await pool.close()

    return NextResponse.json({
      success: true,
      message: 'Files schema extended successfully for Resume Library',
      features: [
        'Archive/restore functionality',
        'Soft delete with restore capability',
        'File tagging system',
        'Notes and comments',
        'Retry tracking for failed extractions',
        'Extraction confidence scoring',
        'Performance indexes',
        'Complete file details view'
      ]
    })

  } catch (error) {
    console.error('Schema extension error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}