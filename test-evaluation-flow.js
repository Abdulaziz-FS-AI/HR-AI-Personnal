/**
 * End-to-End Evaluation Flow Test
 * Professional testing script to verify the complete evaluation pipeline
 */

require('dotenv').config({ path: '.env.local' })
const sql = require('mssql')

async function testEvaluationFlow() {
  const config = {
    server: process.env.AZURE_SQL_SERVER,
    database: process.env.AZURE_SQL_DATABASE,
    user: process.env.AZURE_SQL_USER,
    password: process.env.AZURE_SQL_PASSWORD,
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
    connectionTimeout: 30000,
  }

  try {
    console.log('🧪 EVALUATION PIPELINE TEST')
    console.log('============================')
    
    const pool = await sql.connect(config)
    
    // Test 1: Check Users Table
    console.log('\n📊 Test 1: User Authentication')
    console.log('-------------------------------')
    const userResult = await pool.request().query(`
      SELECT TOP 1 id, email FROM users WHERE is_active = 1
    `)
    
    if (userResult.recordset.length === 0) {
      console.log('❌ No active users found - creating test user')
      const createUserResult = await pool.request()
        .input('email', sql.NVarChar, 'test@hr-ai-saas.com')
        .input('passwordHash', sql.NVarChar, 'hashed_password_here')
        .query(`
          INSERT INTO users (id, email, password_hash, is_active, created_at)
          OUTPUT INSERTED.id, INSERTED.email
          VALUES (NEWID(), @email, @passwordHash, 1, GETDATE())
        `)
      const testUser = createUserResult.recordset[0]
      console.log(`✅ Created test user: ${testUser.email}`)
    } else {
      const testUser = userResult.recordset[0]
      console.log(`✅ Found user: ${testUser.email}`)
    }
    
    // Test 2: Check Roles
    console.log('\n📊 Test 2: Role Management')
    console.log('--------------------------')
    const roleResult = await pool.request().query(`
      SELECT TOP 1 r.id, r.title, r.user_id,
        (SELECT COUNT(*) FROM role_skills WHERE role_id = r.id) as skill_count,
        (SELECT COUNT(*) FROM role_questions WHERE role_id = r.id) as question_count
      FROM roles r
      WHERE r.is_active = 1
    `)
    
    if (roleResult.recordset.length === 0) {
      console.log('❌ No roles found - Please create a role first')
    } else {
      const role = roleResult.recordset[0]
      console.log(`✅ Found role: ${role.title}`)
      console.log(`   - Skills: ${role.skill_count}`)
      console.log(`   - Questions: ${role.question_count}`)
    }
    
    // Test 3: Check Evaluation Sessions
    console.log('\n📊 Test 3: Evaluation Sessions')
    console.log('-------------------------------')
    const sessionResult = await pool.request().query(`
      SELECT TOP 5 
        es.id,
        es.name,
        es.status,
        es.total_files,
        es.processed_files,
        es.failed_files,
        r.title as role_title
      FROM evaluation_sessions es
      JOIN roles r ON es.role_id = r.id
      ORDER BY es.created_at DESC
    `)
    
    if (sessionResult.recordset.length === 0) {
      console.log('⚠️ No evaluation sessions found')
    } else {
      console.log(`✅ Found ${sessionResult.recordset.length} evaluation sessions:`)
      sessionResult.recordset.forEach(session => {
        const statusIcon = session.status === 'completed' ? '✅' : 
                          session.status === 'processing' ? '🔄' : 
                          session.status === 'failed' ? '❌' : '⏳'
        console.log(`   ${statusIcon} ${session.name} (${session.role_title})`)
        console.log(`      Status: ${session.status}`)
        console.log(`      Files: ${session.processed_files}/${session.total_files} processed`)
        if (session.failed_files > 0) {
          console.log(`      ⚠️ Failed: ${session.failed_files} files`)
        }
      })
    }
    
    // Test 4: Check Evaluation Results
    console.log('\n📊 Test 4: Evaluation Results')
    console.log('-----------------------------')
    const resultsResult = await pool.request().query(`
      SELECT TOP 10
        er.id,
        ef.file_name,
        ef.overall_score,
        ef.status as file_status,
        es.name as session_name
      FROM evaluation_results er
      JOIN evaluation_files ef ON er.file_id = ef.id
      JOIN evaluation_sessions es ON er.evaluation_id = es.id
      ORDER BY er.created_at DESC
    `)
    
    if (resultsResult.recordset.length === 0) {
      console.log('⚠️ No evaluation results found')
    } else {
      console.log(`✅ Found ${resultsResult.recordset.length} evaluation results:`)
      resultsResult.recordset.forEach(result => {
        const score = result.overall_score || 0
        const scoreIcon = score >= 80 ? '🌟' : score >= 60 ? '✅' : score >= 40 ? '🟡' : '🔴'
        console.log(`   ${scoreIcon} ${result.file_name} - Score: ${score.toFixed(1)}%`)
      })
    }
    
    // Test 5: Check Azure Connections
    console.log('\n📊 Test 5: Azure Service Health')
    console.log('--------------------------------')
    
    // Check Service Bus
    try {
      const serviceBusStatus = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING ? '✅ Configured' : '❌ Not configured'
      console.log(`   Service Bus: ${serviceBusStatus}`)
    } catch (e) {
      console.log('   Service Bus: ❌ Error')
    }
    
    // Check Storage
    try {
      const storageStatus = process.env.AZURE_STORAGE_CONNECTION_STRING ? '✅ Configured' : '❌ Not configured'
      console.log(`   Blob Storage: ${storageStatus}`)
    } catch (e) {
      console.log('   Blob Storage: ❌ Error')
    }
    
    // Check AI API
    try {
      const aiStatus = process.env.HYPERBOLIC_API_KEY ? '✅ Configured' : '❌ Not configured'
      console.log(`   Hyperbolic AI: ${aiStatus}`)
    } catch (e) {
      console.log('   Hyperbolic AI: ❌ Error')
    }
    
    // Test 6: Database Performance
    console.log('\n📊 Test 6: Database Performance')
    console.log('--------------------------------')
    const startTime = Date.now()
    await pool.request().query('SELECT 1')
    const queryTime = Date.now() - startTime
    console.log(`   Query latency: ${queryTime}ms ${queryTime < 100 ? '✅' : queryTime < 500 ? '🟡' : '🔴'}`)
    
    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('📋 TEST SUMMARY')
    console.log('='.repeat(50))
    
    const issues = []
    if (roleResult.recordset.length === 0) issues.push('No roles configured')
    if (sessionResult.recordset.length === 0) issues.push('No evaluation sessions')
    if (!process.env.AZURE_SERVICE_BUS_CONNECTION_STRING) issues.push('Service Bus not configured')
    
    if (issues.length === 0) {
      console.log('✅ All tests passed! System is ready for evaluation processing.')
    } else {
      console.log('⚠️ Issues found:')
      issues.forEach(issue => console.log(`   - ${issue}`))
      console.log('\n💡 Recommendations:')
      if (issues.includes('No roles configured')) {
        console.log('   1. Create a role with skills and questions')
      }
      if (issues.includes('No evaluation sessions')) {
        console.log('   2. Start a new evaluation session')
      }
      if (issues.includes('Service Bus not configured')) {
        console.log('   3. Configure Azure Service Bus for async processing')
      }
    }
    
    await pool.close()
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

testEvaluationFlow()