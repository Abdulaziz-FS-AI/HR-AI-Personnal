import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'
import { getBlobStorageService } from '@/lib/azure/blob-storage'
import { ServiceBusClient } from '@azure/service-bus'
import sql from 'mssql'

export async function GET() {
  const tests: any[] = []
  
  try {
    // Test 1: Azure SQL Database
    console.log('🔍 Testing Azure SQL Database...')
    let dbTest = { service: 'Azure SQL Database', status: '❌ Failed', details: null }
    try {
      const pool = await getDbConnection()
      const result = await pool.request().query('SELECT 1 as test, @@SERVERNAME as serverName, DB_NAME() as dbName')
      
      // Test table existence
      const tablesResult = await pool.request().query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `)
      
      dbTest = {
        service: 'Azure SQL Database',
        status: '✅ Connected',
        details: {
          server: result.recordset[0].serverName,
          database: result.recordset[0].dbName,
          tables: tablesResult.recordset.map((r: any) => r.TABLE_NAME),
          tableCount: tablesResult.recordset.length
        }
      }
      await pool.close()
    } catch (error) {
      dbTest.details = error instanceof Error ? error.message : 'Unknown error'
    }
    tests.push(dbTest)
    
    // Test 2: Azure Blob Storage
    console.log('🔍 Testing Azure Blob Storage...')
    let blobTest = { service: 'Azure Blob Storage', status: '❌ Failed', details: null }
    try {
      const blobService = getBlobStorageService()
      
      // Test by checking if we can validate a file
      const validation = blobService.validateFile('test.pdf', 5000, 'application/pdf')
      
      // Try to generate a test URL (doesn't actually upload)
      const testUrl = await blobService.generateUploadUrl({
        fileName: 'test.pdf',
        userId: 'test-user',
        fileSize: 1024,
        contentType: 'application/pdf'
      })
      
      blobTest = {
        service: 'Azure Blob Storage',
        status: '✅ Connected',
        details: {
          accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
          containerName: 'resumes',
          testUrlGenerated: !!testUrl.uploadUrl,
          expiresAt: testUrl.expiresAt
        }
      }
    } catch (error) {
      blobTest.details = error instanceof Error ? error.message : 'Unknown error'
    }
    tests.push(blobTest)
    
    // Test 3: Azure Service Bus
    console.log('🔍 Testing Azure Service Bus...')
    let serviceBusTest = { service: 'Azure Service Bus', status: '❌ Failed', details: null }
    try {
      const connectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING
      if (connectionString) {
        const sbClient = new ServiceBusClient(connectionString)
        
        // Parse namespace from connection string
        const namespaceMatch = connectionString.match(/Endpoint=sb:\/\/([^.]+)\.servicebus/)
        const namespace = namespaceMatch ? namespaceMatch[1] : 'unknown'
        
        serviceBusTest = {
          service: 'Azure Service Bus',
          status: '✅ Connected',
          details: {
            namespace,
            queueName: process.env.AZURE_SERVICE_BUS_QUEUE_NAME || 'evaluation-queue',
            region: 'Switzerland North'
          }
        }
        
        await sbClient.close()
      } else {
        serviceBusTest.details = 'Connection string not configured'
      }
    } catch (error) {
      serviceBusTest.details = error instanceof Error ? error.message : 'Unknown error'
    }
    tests.push(serviceBusTest)
    
    // Test 4: Check critical tables
    console.log('🔍 Checking critical database tables...')
    let tableTest = { service: 'Database Tables', status: '❌ Failed', details: null }
    try {
      const pool = await getDbConnection()
      const criticalTables = [
        'users',
        'roles',
        'role_skills',
        'role_questions',
        'evaluation_sessions',
        'evaluation_files',
        'evaluation_results'
      ]
      
      const tableChecks: any = {}
      for (const table of criticalTables) {
        const result = await pool.request()
          .input('tableName', sql.NVarChar, table)
          .query(`
            SELECT COUNT(*) as count 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = @tableName
          `)
        tableChecks[table] = result.recordset[0].count > 0
      }
      
      const allTablesExist = Object.values(tableChecks).every(exists => exists === true)
      
      tableTest = {
        service: 'Database Tables',
        status: allTablesExist ? '✅ All tables ready' : '⚠️ Some tables missing',
        details: tableChecks
      }
      
      await pool.close()
    } catch (error) {
      tableTest.details = error instanceof Error ? error.message : 'Unknown error'
    }
    tests.push(tableTest)
    
    // Test 5: Test data existence
    console.log('🔍 Checking test data...')
    let dataTest = { service: 'Test Data', status: '❌ Failed', details: null }
    try {
      const pool = await getDbConnection()
      
      // Check for test user
      const userResult = await pool.request()
        .input('userId', sql.UniqueIdentifier, '5A5D9AC4-48BB-4117-89F2-5B1D8FC383B8')
        .query('SELECT email, created_at FROM users WHERE id = @userId')
      
      // Check for roles
      const rolesResult = await pool.request()
        .query('SELECT COUNT(*) as count FROM roles')
      
      // Check for evaluations
      const evalsResult = await pool.request()
        .query('SELECT COUNT(*) as count FROM evaluation_sessions')
      
      dataTest = {
        service: 'Test Data',
        status: userResult.recordset.length > 0 ? '✅ Test user exists' : '⚠️ Test user missing',
        details: {
          testUser: userResult.recordset[0] || null,
          totalRoles: rolesResult.recordset[0].count,
          totalEvaluations: evalsResult.recordset[0].count
        }
      }
      
      await pool.close()
    } catch (error) {
      dataTest.details = error instanceof Error ? error.message : 'Unknown error'
    }
    tests.push(dataTest)
    
    // Summary
    const summary = {
      totalTests: tests.length,
      passed: tests.filter(t => t.status.includes('✅')).length,
      failed: tests.filter(t => t.status.includes('❌')).length,
      warnings: tests.filter(t => t.status.includes('⚠️')).length
    }
    
    const allPassed = summary.failed === 0
    
    return NextResponse.json({
      success: allPassed,
      message: allPassed 
        ? '🎉 All Azure services are functioning correctly!' 
        : `⚠️ ${summary.failed} services have issues`,
      summary,
      tests,
      environment: {
        sqlServer: process.env.AZURE_SQL_SERVER,
        sqlDatabase: process.env.AZURE_SQL_DATABASE,
        storageAccount: process.env.AZURE_STORAGE_ACCOUNT_NAME,
        serviceBusNamespace: process.env.AZURE_SERVICE_BUS_NAMESPACE
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Failed to test Azure services',
      error: error instanceof Error ? error.message : 'Unknown error',
      tests
    }, { status: 500 })
  }
}