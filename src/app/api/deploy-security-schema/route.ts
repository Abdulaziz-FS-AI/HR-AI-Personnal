import { NextResponse } from "next/server"
import { executeQueryStrict } from "@/lib/db-utils"

export async function POST() {
  try {
    const schemas = [
      // Audit logs table for tracking all data access
      `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='audit_logs' AND xtype='U')
      CREATE TABLE audit_logs (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        action NVARCHAR(100) NOT NULL,
        resource_type NVARCHAR(50) NOT NULL,
        resource_id NVARCHAR(100) NOT NULL,
        metadata NTEXT NULL,
        ip_address NVARCHAR(45) NULL,
        user_agent NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      `,
      
      // User quotas table for tracking usage limits
      `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_quotas' AND xtype='U')
      CREATE TABLE user_quotas (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER UNIQUE NOT NULL,
        max_files INT DEFAULT 100,
        max_evaluations_per_month INT DEFAULT 10,
        max_storage_mb INT DEFAULT 1024,
        max_resume_uploads_per_day INT DEFAULT 50,
        current_files INT DEFAULT 0,
        current_storage_mb DECIMAL(10,2) DEFAULT 0,
        evaluations_this_month INT DEFAULT 0,
        uploads_today INT DEFAULT 0,
        last_reset_date DATETIME2 DEFAULT GETUTCDATE(),
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      `,
      
      // Data export logs for tracking user exports
      `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='export_logs' AND xtype='U')
      CREATE TABLE export_logs (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        export_type NVARCHAR(50) NOT NULL, -- 'results', 'resumes', 'all_data'
        format NVARCHAR(20) NOT NULL, -- 'csv', 'json', 'excel'
        file_count INT NOT NULL,
        file_size_mb DECIMAL(10,2) NOT NULL,
        download_url NVARCHAR(500) NULL,
        expires_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      `,
      
      // Security events table for tracking suspicious activities
      `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='security_events' AND xtype='U')
      CREATE TABLE security_events (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NULL,
        event_type NVARCHAR(100) NOT NULL, -- 'unauthorized_access', 'rate_limit_exceeded', etc
        severity NVARCHAR(20) NOT NULL, -- 'info', 'warning', 'critical'
        description NTEXT NOT NULL,
        ip_address NVARCHAR(45) NULL,
        request_path NVARCHAR(500) NULL,
        metadata NTEXT NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
      );
      `,
      
      // User sessions table for tracking active sessions
      `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_sessions' AND xtype='U')
      CREATE TABLE user_sessions (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL,
        session_token NVARCHAR(255) UNIQUE NOT NULL,
        ip_address NVARCHAR(45) NULL,
        user_agent NVARCHAR(500) NULL,
        last_activity DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        expires_at DATETIME2 NOT NULL,
        is_active BIT DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      `,
      
      // Create indexes for performance
      `
      -- Audit logs indexes
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_audit_logs_user_id')
        CREATE INDEX IX_audit_logs_user_id ON audit_logs (user_id, created_at DESC);
      
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_audit_logs_resource')
        CREATE INDEX IX_audit_logs_resource ON audit_logs (resource_type, resource_id);
      
      -- Security events indexes
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_security_events_user_id')
        CREATE INDEX IX_security_events_user_id ON security_events (user_id, created_at DESC);
      
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_security_events_severity')
        CREATE INDEX IX_security_events_severity ON security_events (severity, created_at DESC);
      
      -- User sessions indexes
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_user_sessions_user_id')
        CREATE INDEX IX_user_sessions_user_id ON user_sessions (user_id, is_active);
      
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_user_sessions_token')
        CREATE INDEX IX_user_sessions_token ON user_sessions (session_token);
      
      -- Export logs indexes
      IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_export_logs_user_id')
        CREATE INDEX IX_export_logs_user_id ON export_logs (user_id, created_at DESC);
      `
    ]
    
    // Execute each schema creation
    for (let i = 0; i < schemas.length; i++) {
      await executeQueryStrict(async (pool) => {
        return await pool.request().query(schemas[i])
      })
    }
    
    return NextResponse.json({
      success: true,
      message: "Security schema deployed successfully",
      tables: [
        'audit_logs',
        'user_quotas',
        'export_logs',
        'security_events',
        'user_sessions'
      ]
    })
    
  } catch (error) {
    console.error('Security schema deployment error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to deploy security schema",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}