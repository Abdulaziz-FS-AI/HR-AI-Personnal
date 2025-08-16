const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

console.log('🧪 TESTING COMPLETE EVALUATION FLOW');
console.log('====================================\n');

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

async function testEvaluationFlow() {
  let pool;
  try {
    pool = await sql.connect(config);
    console.log('✅ Database connected');
    
    // 1. Get test user and role
    console.log('\n📋 Step 1: Finding test user and role...');
    
    const testUser = await pool.request().query(`
      SELECT TOP 1 id, email FROM users 
      WHERE email LIKE '%abdulaziz%'
    `);
    
    if (testUser.recordset.length === 0) {
      throw new Error('No test user found');
    }
    
    const userId = testUser.recordset[0].id;
    console.log(`👤 Test user: ${testUser.recordset[0].email}`);
    
    const testRole = await pool.request()
      .input('userId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT TOP 1 id, title FROM roles 
        WHERE user_id = @userId AND is_active = 1
      `);
    
    if (testRole.recordset.length === 0) {
      throw new Error('No active role found for user');
    }
    
    const roleId = testRole.recordset[0].id;
    console.log(`🎯 Test role: ${testRole.recordset[0].title}`);
    
    // 2. Create test evaluation
    console.log('\n📋 Step 2: Creating test evaluation...');
    
    const evaluationId = require('crypto').randomUUID();
    const evaluationName = `Test Evaluation - ${new Date().toLocaleTimeString()}`;
    
    await pool.request()
      .input('id', sql.UniqueIdentifier, evaluationId)
      .input('userId', sql.UniqueIdentifier, userId)
      .input('roleId', sql.UniqueIdentifier, roleId)
      .input('name', sql.NVarChar, evaluationName)
      .query(`
        INSERT INTO evaluation_sessions (
          id, user_id, role_id, name, status, 
          total_files, processed_files, failed_files,
          created_at, updated_at
        )
        VALUES (
          @id, @userId, @roleId, @name, 'draft',
          0, 0, 0, GETDATE(), GETDATE()
        )
      `);
    
    console.log(`✅ Created evaluation: ${evaluationName}`);
    console.log(`   ID: ${evaluationId}`);
    
    // 3. Add test file with sample resume text
    console.log('\n📋 Step 3: Adding test file...');
    
    const fileId = require('crypto').randomUUID();
    const testResumeText = `
John Smith
Senior Software Engineer
Email: john.smith@email.com
Phone: (555) 123-4567

EXPERIENCE:
- 5 years of software development experience
- Expert in JavaScript, Python, and React
- Led development of 3 major web applications
- Experience with cloud platforms like AWS and Azure

EDUCATION:
- Bachelor of Science in Computer Science
- University of Technology, 2018

SKILLS:
- JavaScript, Python, React, Node.js
- AWS, Azure, Docker, Kubernetes
- Project management and team leadership
- Agile development methodologies
    `.trim();
    
    await pool.request()
      .input('id', sql.UniqueIdentifier, fileId)
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .input('fileName', sql.NVarChar, 'john_smith_resume.pdf')
      .input('blobName', sql.NVarChar, `test-${fileId}.pdf`)
      .input('fileSize', sql.BigInt, testResumeText.length)
      .input('extractedText', sql.NText, testResumeText)
      .query(`
        INSERT INTO evaluation_files (
          id, evaluation_id, file_name, blob_name, file_size,
          status, extracted_text, created_at, updated_at
        )
        VALUES (
          @id, @evaluationId, @fileName, @blobName, @fileSize,
          'uploaded', @extractedText, GETDATE(), GETDATE()
        )
      `);
    
    console.log(`✅ Added test file: john_smith_resume.pdf`);
    
    // Update evaluation with file count
    await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query(`
        UPDATE evaluation_sessions 
        SET total_files = 1, status = 'pending', updated_at = GETDATE()
        WHERE id = @evaluationId
      `);
    
    // 4. Test processing endpoint by calling it via HTTP
    console.log('\n📋 Step 4: Testing evaluation processing...');
    
    try {
      const response = await fetch(`http://localhost:3000/api/evaluations/${evaluationId}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add a test user header if needed
          'X-Test-User-Id': userId
        }
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log('✅ Processing endpoint responded successfully');
        console.log(`   Processed: ${result.data.processedFiles}/${result.data.totalFiles} files`);
        console.log(`   Failed: ${result.data.failedFiles} files`);
        console.log(`   Processing time: ${result.data.processingTime}ms`);
      } else {
        console.log('❌ Processing endpoint failed:', result.error || 'Unknown error');
        console.log('   Details:', result.details || 'No details');
      }
    } catch (fetchError) {
      console.log('⚠️ Could not test processing endpoint (server not running?)');
      console.log('   Error:', fetchError.message);
    }
    
    // 5. Check final evaluation status
    console.log('\n📋 Step 5: Checking final evaluation status...');
    
    const finalStatus = await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query(`
        SELECT 
          es.*,
          (SELECT COUNT(*) FROM evaluation_files WHERE evaluation_id = es.id) as file_count,
          (SELECT COUNT(*) FROM evaluation_results WHERE evaluation_id = es.id) as result_count
        FROM evaluation_sessions es
        WHERE es.id = @evaluationId
      `);
    
    if (finalStatus.recordset.length > 0) {
      const eval = finalStatus.recordset[0];
      console.log(`📊 Final Status: ${eval.status}`);
      console.log(`   Total Files: ${eval.total_files}`);
      console.log(`   Processed: ${eval.processed_files}`);
      console.log(`   Failed: ${eval.failed_files}`);
      console.log(`   Average Score: ${eval.average_score || 'N/A'}`);
      console.log(`   Files in DB: ${eval.file_count}`);
      console.log(`   Results in DB: ${eval.result_count}`);
    }
    
    console.log('\n✅ EVALUATION FLOW TEST COMPLETED');
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query(`DELETE FROM evaluation_results WHERE evaluation_id = @evaluationId`);
    
    await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query(`DELETE FROM evaluation_files WHERE evaluation_id = @evaluationId`);
    
    await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query(`DELETE FROM evaluation_sessions WHERE id = @evaluationId`);
    
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.originalError) {
      console.error('   SQL Error:', error.originalError.message);
    }
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

testEvaluationFlow();