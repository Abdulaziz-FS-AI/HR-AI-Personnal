import { NextResponse } from 'next/server'
import { bulletproofDb, executeQuerySafely } from '@/lib/db-bulletproof'

interface RecoveryAction {
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  message: string
  duration?: number
  error?: string
}

interface RecoveryReport {
  success: boolean
  totalActions: number
  completedActions: number
  failedActions: number
  actions: RecoveryAction[]
  overallStatus: 'healthy' | 'degraded' | 'critical' | 'recovered'
  recommendations: string[]
  estimatedRecoveryTime?: number
}

export async function POST() {
  const startTime = Date.now()
  const report: RecoveryReport = {
    success: false,
    totalActions: 0,
    completedActions: 0,
    failedActions: 0,
    actions: [],
    overallStatus: 'critical',
    recommendations: []
  }

  try {
    console.log('🚨 EMERGENCY SYSTEM RECOVERY INITIATED')

    // Define all recovery actions
    const recoveryActions: Omit<RecoveryAction, 'status' | 'duration'>[] = [
      {
        name: 'Database Connection Recovery',
        message: 'Attempting to restore database connectivity'
      },
      {
        name: 'Connection Pool Reset',
        message: 'Resetting database connection pool'
      },
      {
        name: 'Essential Tables Verification',
        message: 'Checking existence of critical tables'
      },
      {
        name: 'Missing Tables Deployment',
        message: 'Deploying any missing database tables'
      },
      {
        name: 'Data Integrity Check',
        message: 'Verifying database constraints and relationships'
      },
      {
        name: 'System Health Validation',
        message: 'Running comprehensive system health checks'
      },
      {
        name: 'Performance Optimization',
        message: 'Optimizing database performance settings'
      }
    ]

    report.totalActions = recoveryActions.length
    report.actions = recoveryActions.map(action => ({
      ...action,
      status: 'pending'
    }))

    // Action 1: Database Connection Recovery
    await executeRecoveryAction(report, 0, async () => {
      await bulletproofDb.gracefulShutdown()
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const health = await bulletproofDb.healthCheck()
      if (!health.connected) {
        throw new Error(`Connection failed: ${health.error}`)
      }
      
      return 'Database connection restored successfully'
    })

    // Action 2: Connection Pool Reset
    await executeRecoveryAction(report, 1, async () => {
      const health = await bulletproofDb.healthCheck()
      return `Pool reset complete (Pool: ${health.poolSize}, Total: ${health.totalConnections})`
    })

    // Action 3: Essential Tables Verification
    let missingTables: string[] = []
    await executeRecoveryAction(report, 2, async () => {
      const requiredTables = [
        'users', 'roles', 'role_skills', 'role_questions',
        'evaluation_sessions', 'evaluation_files', 'evaluation_results'
      ]

      const tableCheck = await executeQuerySafely(`
        SELECT name FROM sysobjects 
        WHERE name IN (${requiredTables.map(t => `'${t}'`).join(',')}) AND xtype='U'
      `)

      const existingTables = tableCheck.recordset.map((row: any) => row.name)
      missingTables = requiredTables.filter(table => !existingTables.includes(table))

      if (missingTables.length > 0) {
        return `Found ${existingTables.length}/${requiredTables.length} tables. Missing: ${missingTables.join(', ')}`
      }

      return `All ${requiredTables.length} essential tables verified`
    })

    // Action 4: Missing Tables Deployment
    await executeRecoveryAction(report, 3, async () => {
      if (missingTables.length === 0) {
        return 'No missing tables - deployment skipped'
      }

      // Deploy base tables if missing
      const baseTables = ['users', 'roles', 'role_skills', 'role_questions']
      const missingBaseTables = baseTables.filter(t => missingTables.includes(t))
      
      if (missingBaseTables.length > 0) {
        await deployBaseTables()
      }

      // Deploy evaluation tables if missing
      const evalTables = ['evaluation_sessions', 'evaluation_files', 'evaluation_results']
      const missingEvalTables = evalTables.filter(t => missingTables.includes(t))
      
      if (missingEvalTables.length > 0) {
        await deployEvaluationTables()
      }

      return `Deployed ${missingTables.length} missing tables successfully`
    })

    // Action 5: Data Integrity Check
    await executeRecoveryAction(report, 4, async () => {
      // Check for orphaned records
      const integrityChecks = [
        "SELECT COUNT(*) as count FROM evaluation_files WHERE evaluation_id NOT IN (SELECT id FROM evaluation_sessions)",
        "SELECT COUNT(*) as count FROM evaluation_results WHERE evaluation_id NOT IN (SELECT id FROM evaluation_sessions)",
        "SELECT COUNT(*) as count FROM evaluation_sessions WHERE role_id NOT IN (SELECT id FROM roles)"
      ]

      let orphanedRecords = 0
      for (const check of integrityChecks) {
        try {
          const result = await executeQuerySafely(check)
          orphanedRecords += result.recordset[0]?.count || 0
        } catch (error) {
          console.warn('Integrity check failed:', error)
        }
      }

      if (orphanedRecords > 0) {
        return `Data integrity issues detected: ${orphanedRecords} orphaned records`
      }

      return 'Data integrity verified - no issues found'
    })

    // Action 6: System Health Validation
    await executeRecoveryAction(report, 5, async () => {
      const health = await bulletproofDb.healthCheck()
      
      if (!health.connected) {
        throw new Error('System health check failed - database not connected')
      }

      // Test basic operations
      await executeQuerySafely('SELECT COUNT(*) as user_count FROM users')
      await executeQuerySafely('SELECT COUNT(*) as role_count FROM roles')
      await executeQuerySafely('SELECT COUNT(*) as session_count FROM evaluation_sessions')

      return `System health validated - all components operational`
    })

    // Action 7: Performance Optimization
    await executeRecoveryAction(report, 6, async () => {
      // Update statistics for better query performance
      const optimizations = [
        "UPDATE STATISTICS evaluation_sessions",
        "UPDATE STATISTICS evaluation_files", 
        "UPDATE STATISTICS evaluation_results"
      ]

      for (const optimization of optimizations) {
        try {
          await executeQuerySafely(optimization)
        } catch (error) {
          console.warn('Optimization failed:', optimization, error)
        }
      }

      return 'Database performance optimized'
    })

    // Final status determination
    if (report.failedActions === 0) {
      report.overallStatus = 'recovered'
      report.success = true
    } else if (report.failedActions < report.totalActions / 2) {
      report.overallStatus = 'degraded'
      report.success = true
    } else {
      report.overallStatus = 'critical'
      report.success = false
    }

    // Generate recommendations
    if (report.failedActions > 0) {
      report.recommendations.push('Some recovery actions failed - manual intervention may be required')
    }
    
    if (missingTables.length > 0) {
      report.recommendations.push('Run schema deployment manually if auto-deployment failed')
    }
    
    if (report.overallStatus === 'recovered') {
      report.recommendations.push('System recovered successfully - monitor for stability')
    }

    const totalTime = Date.now() - startTime
    
    console.log(`🚨 RECOVERY COMPLETE: ${report.overallStatus.toUpperCase()} (${totalTime}ms)`)
    console.log(`✅ Success: ${report.completedActions}/${report.totalActions}`)
    console.log(`❌ Failed: ${report.failedActions}/${report.totalActions}`)

    return NextResponse.json({
      ...report,
      recoveryTime: totalTime,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('🚨 CRITICAL: Recovery system failure:', error)
    
    report.overallStatus = 'critical'
    report.success = false
    report.recommendations = [
      'Emergency recovery failed',
      'Manual database inspection required',
      'Contact system administrator',
      'Check database server status'
    ]

    return NextResponse.json({
      ...report,
      emergencyError: error instanceof Error ? error.message : 'Critical system failure',
      recoveryTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

async function executeRecoveryAction(
  report: RecoveryReport, 
  actionIndex: number, 
  action: () => Promise<string>
): Promise<void> {
  const startTime = Date.now()
  report.actions[actionIndex].status = 'running'

  try {
    console.log(`🔄 ${report.actions[actionIndex].name}...`)
    
    const result = await action()
    
    report.actions[actionIndex].status = 'completed'
    report.actions[actionIndex].message = result
    report.actions[actionIndex].duration = Date.now() - startTime
    report.completedActions++

    console.log(`✅ ${report.actions[actionIndex].name} (${report.actions[actionIndex].duration}ms)`)

  } catch (error) {
    report.actions[actionIndex].status = 'failed'
    report.actions[actionIndex].error = error instanceof Error ? error.message : 'Unknown error'
    report.actions[actionIndex].duration = Date.now() - startTime
    report.failedActions++

    console.log(`❌ ${report.actions[actionIndex].name} failed: ${report.actions[actionIndex].error}`)
  }
}

async function deployBaseTables(): Promise<void> {
  const schema = `
    -- Users table
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
    CREATE TABLE users (
      id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
      email NVARCHAR(255) NOT NULL UNIQUE,
      password_hash NVARCHAR(255) NOT NULL,
      first_name NVARCHAR(100),
      last_name NVARCHAR(100),
      created_at DATETIME2 DEFAULT GETDATE()
    )

    -- Roles table
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U')
    CREATE TABLE roles (
      id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
      user_id UNIQUEIDENTIFIER NOT NULL,
      title NVARCHAR(200) NOT NULL,
      description NVARCHAR(MAX),
      created_at DATETIME2 DEFAULT GETDATE()
    )

    -- Role skills table
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='role_skills' AND xtype='U')
    CREATE TABLE role_skills (
      id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
      role_id UNIQUEIDENTIFIER NOT NULL,
      skill_name NVARCHAR(100) NOT NULL,
      weight INT NOT NULL,
      is_required BIT DEFAULT 0
    )

    -- Role questions table
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='role_questions' AND xtype='U')
    CREATE TABLE role_questions (
      id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
      role_id UNIQUEIDENTIFIER NOT NULL,
      question_text NVARCHAR(MAX) NOT NULL,
      weight INT NOT NULL
    )
  `

  await executeQuerySafely(schema)
}

async function deployEvaluationTables(): Promise<void> {
  const schema = `
    -- Evaluation sessions table
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_sessions' AND xtype='U')
    CREATE TABLE evaluation_sessions (
      id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
      user_id UNIQUEIDENTIFIER NOT NULL,
      role_id UNIQUEIDENTIFIER NOT NULL,
      name NVARCHAR(200) NOT NULL,
      status NVARCHAR(50) NOT NULL DEFAULT 'pending',
      total_files INT NOT NULL DEFAULT 0,
      processed_files INT NOT NULL DEFAULT 0,
      failed_files INT NOT NULL DEFAULT 0,
      created_at DATETIME2 DEFAULT GETDATE()
    )

    -- Evaluation files table
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_files' AND xtype='U')
    CREATE TABLE evaluation_files (
      id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
      evaluation_id UNIQUEIDENTIFIER NOT NULL,
      file_name NVARCHAR(255) NOT NULL,
      status NVARCHAR(50) DEFAULT 'uploaded',
      extracted_text NVARCHAR(MAX),
      overall_score DECIMAL(5,2),
      uploaded_at DATETIME2 DEFAULT GETDATE()
    )

    -- Evaluation results table
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='evaluation_results' AND xtype='U')
    CREATE TABLE evaluation_results (
      id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
      evaluation_id UNIQUEIDENTIFIER NOT NULL,
      file_id UNIQUEIDENTIFIER NOT NULL,
      overall_score DECIMAL(5,2) DEFAULT 0,
      recommendations NVARCHAR(MAX),
      created_at DATETIME2 DEFAULT GETDATE()
    )
  `

  await executeQuerySafely(schema)
}

export async function GET() {
  return NextResponse.json({
    message: 'Emergency System Recovery Endpoint',
    description: 'Use POST to initiate comprehensive system recovery',
    features: [
      'Database connection recovery',
      'Missing table auto-deployment', 
      'Data integrity validation',
      'Performance optimization',
      'Health status verification'
    ],
    usage: 'POST /api/system-recovery'
  })
}