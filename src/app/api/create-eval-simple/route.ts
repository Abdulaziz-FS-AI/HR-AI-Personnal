import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'

export async function GET() {
  let pool = null
  
  try {
    pool = await getDbConnection()
    
    // Simple evaluation_sessions table creation
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_sessions' AND xtype='U')
      CREATE TABLE evaluation_sessions (
        id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        user_id UNIQUEIDENTIFIER NOT NULL,
        role_id UNIQUEIDENTIFIER NOT NULL,
        name NVARCHAR(200) NOT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'pending',
        total_files INT NOT NULL DEFAULT 0,
        processed_files INT NOT NULL DEFAULT 0,
        failed_files INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        started_at DATETIME NULL,
        completed_at DATETIME NULL
      )
    `)

    // Simple evaluation_files table  
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_files' AND xtype='U')
      CREATE TABLE evaluation_files (
        id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        evaluation_id UNIQUEIDENTIFIER NOT NULL,
        file_name NVARCHAR(255) NOT NULL,
        file_size INT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'created',
        extracted_text NVARCHAR(MAX) NULL,
        overall_score DECIMAL(5,2) NULL,
        uploaded_at DATETIME DEFAULT GETDATE(),
        processed_at DATETIME NULL
      )
    `)

    // Simple evaluation_results table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_results' AND xtype='U')
      CREATE TABLE evaluation_results (
        id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        evaluation_id UNIQUEIDENTIFIER NOT NULL,
        file_id UNIQUEIDENTIFIER NOT NULL,
        recommendation NVARCHAR(MAX) NULL,
        created_at DATETIME DEFAULT GETDATE()
      )
    `)

    await pool.close()

    return NextResponse.json({
      success: true,
      message: 'Simple evaluation tables created',
      tables: ['evaluation_sessions', 'evaluation_files', 'evaluation_results']
    })

  } catch (error) {
    console.error('Error:', error)
    if (pool) await pool.close()
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}