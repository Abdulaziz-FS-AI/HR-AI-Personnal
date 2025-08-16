const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false }
};

async function testEndpointFlow() {
  try {
    console.log('🧪 TESTING EVALUATION ENDPOINTS');
    console.log('==============================\n');
    
    const pool = await sql.connect(config);
    
    // Get test user and role
    const testUser = await pool.request().query(`
      SELECT TOP 1 id, email FROM users WHERE email LIKE '%abdulaziz%'
    `);
    const userId = testUser.recordset[0].id;
    
    const testRole = await pool.request()
      .input('userId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT TOP 1 id, title FROM roles 
        WHERE user_id = @userId AND is_active = 1
      `);
    const roleId = testRole.recordset[0].id;
    
    console.log(`👤 User: ${testUser.recordset[0].email}`);
    console.log(`🎯 Role: ${testRole.recordset[0].title}`);
    
    // Step 1: Create evaluation via evaluation-ultimate endpoint
    console.log('\n📋 Step 1: Creating evaluation...');
    
    const sessionData = {
      name: `API Test Evaluation - ${new Date().toLocaleTimeString()}`,
      roleId: roleId,
      roleTitle: testRole.recordset[0].title,
      files: [
        { id: require('crypto').randomUUID(), name: 'test.pdf', size: 1024 }
      ]
    };
    
    const createResponse = await fetch('http://localhost:3002/api/evaluation-ultimate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-User-Id': userId
      },
      body: JSON.stringify(sessionData)
    });
    
    if (!createResponse.ok) {
      throw new Error(`Create failed: ${createResponse.status}`);
    }
    
    const createResult = await createResponse.json();
    const evaluationId = createResult.data.id;
    
    console.log(`✅ Evaluation created: ${evaluationId}`);
    
    // Step 2: Test processing endpoint 
    console.log('\n📋 Step 2: Testing processing endpoint...');
    
    const processResponse = await fetch(`http://localhost:3002/api/evaluations/${evaluationId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-User-Id': userId
      }
    });
    
    if (processResponse.ok) {
      const processResult = await processResponse.json();
      console.log(`✅ Processing endpoint working`);
      console.log(`   Response: ${JSON.stringify(processResult, null, 2)}`);
    } else {
      const error = await processResponse.json();
      console.log(`❌ Processing failed: ${error.error}`);
    }
    
    // Clean up
    console.log('\n🧹 Cleaning up...');
    await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query('DELETE FROM evaluation_results WHERE evaluation_id = @evaluationId');
    await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query('DELETE FROM evaluation_files WHERE evaluation_id = @evaluationId');
    await pool.request()
      .input('evaluationId', sql.UniqueIdentifier, evaluationId)
      .query('DELETE FROM evaluation_sessions WHERE id = @evaluationId');
    
    console.log('✅ Test completed');
    
    await pool.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEndpointFlow();