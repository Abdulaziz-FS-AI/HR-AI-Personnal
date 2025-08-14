import { NextResponse } from "next/server"
import { executeQueryStrict } from "@/lib/db-utils"

export async function POST() {
  try {
    // Update evaluation_files table
    await executeQueryStrict(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('evaluation_files') 
        AND name = 'blob_url'
      )
      BEGIN
        ALTER TABLE evaluation_files ADD 
          blob_url NVARCHAR(500) NULL,
          blob_filename NVARCHAR(255) NULL,
          mime_type NVARCHAR(100) NULL,
          extracted_text NTEXT NULL,
          extraction_status NVARCHAR(50) DEFAULT 'pending',
          ai_analysis_status NVARCHAR(50) DEFAULT 'pending'
      END
    `)

    // Update evaluation_results table if needed
    await executeQueryStrict(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('evaluation_results') 
        AND name = 'skill_matches'
      )
      BEGIN
        ALTER TABLE evaluation_results ADD 
          skill_matches NTEXT NULL,
          question_answers NTEXT NULL,
          recommendations NTEXT NULL,
          red_flags NTEXT NULL,
          ai_raw_response NTEXT NULL,
          processing_time_ms INT NULL,
          error_message NVARCHAR(500) NULL
      END
    `)

    // Add indexes for performance
    await executeQueryStrict(`
      IF NOT EXISTS (
        SELECT * FROM sys.indexes 
        WHERE name = 'IX_evaluation_files_session_status'
      )
      CREATE INDEX IX_evaluation_files_session_status 
      ON evaluation_files(session_id, status)
    `)

    return NextResponse.json({
      success: true,
      message: "Evaluation schema updated successfully"
    })

  } catch (error) {
    console.error('Schema update error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    )
  }
}