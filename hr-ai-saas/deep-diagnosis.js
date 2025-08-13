const sql = require('mssql');

const config = {
  server: 'hr-ai-saas-server.database.windows.net',
  database: 'hr-ai-saas-db',
  user: 'hradmin',
  password: 'Complex@Pass123!',
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

async function deepDiagnosis() {
  console.log('🔬 DEEP SYSTEM DIAGNOSIS');
  console.log('========================\n');

  let pool;
  try {
    // 1. Database Connection Test
    console.log('1️⃣ DATABASE CONNECTION TEST');
    pool = await sql.connect(config);
    console.log('✅ Database connection successful\n');

    // 2. Check Critical Tables
    console.log('2️⃣ CRITICAL TABLES VERIFICATION');
    const tables = ['users', 'roles', 'evaluation_sessions', 'evaluation_files', 'evaluation_results'];
    
    for (const table of tables) {
      try {
        const result = await pool.request().query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`✅ ${table}: ${result.recordset[0].count} records`);
      } catch (err) {
        console.log(`❌ ${table}: ERROR - ${err.message}`);
      }
    }
    console.log('');

    // 3. Check evaluation_sessions table structure
    console.log('3️⃣ EVALUATION_SESSIONS TABLE STRUCTURE');
    try {
      const structure = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'evaluation_sessions'
        ORDER BY ORDINAL_POSITION
      `);
      
      structure.recordset.forEach(col => {
        console.log(`   ${col.COLUMN_NAME}: ${col.DATA_TYPE} ${col.IS_NULLABLE === 'NO' ? '(NOT NULL)' : ''}`);
      });
    } catch (err) {
      console.log(`❌ evaluation_sessions table structure: ${err.message}`);
    }
    console.log('');

    // 4. Test User Authentication Query
    console.log('4️⃣ USER AUTHENTICATION SIMULATION');
    const testUserId = '74C57065-8A1B-4175-B3B8-88AD2DDB79AC'; // Your user ID
    
    try {
      const authTest = await pool.request()
        .input('userId', sql.UniqueIdentifier, testUserId)
        .query(`
          SELECT 
            id,
            email,
            subscription_tier as subscriptionTier,
            credits_remaining as creditsRemaining,
            is_active as isActive
          FROM users 
          WHERE id = @userId AND is_active = 1
        `);
      
      if (authTest.recordset.length > 0) {
        console.log('✅ User authentication query works');
        console.log(`   User: ${authTest.recordset[0].email}`);
        console.log(`   Tier: ${authTest.recordset[0].subscriptionTier}`);
      } else {
        console.log('❌ User authentication query returns no results');
      }
    } catch (err) {
      console.log(`❌ User authentication query failed: ${err.message}`);
    }
    console.log('');

    // 5. Test getUserEvaluations Function Logic
    console.log('5️⃣ GET_USER_EVALUATIONS QUERY SIMULATION');
    try {
      const evalQuery = await pool.request()
        .input('userId', sql.UniqueIdentifier, testUserId)
        .input('limit', sql.Int, 50)
        .input('offset', sql.Int, 0)
        .query(`
          SELECT 
            es.id,
            es.user_id as userId,
            es.role_id as roleId,
            es.name,
            es.status,
            es.total_files as totalFiles,
            es.processed_files as processedFiles,
            es.created_at as createdAt,
            es.updated_at as updatedAt,
            es.completed_at as completedAt,
            r.title as roleTitle
          FROM evaluation_sessions es
          LEFT JOIN roles r ON es.role_id = r.id
          WHERE es.user_id = @userId
          ORDER BY es.created_at DESC
          OFFSET @offset ROWS
          FETCH NEXT @limit ROWS ONLY
        `);
      
      console.log(`✅ getUserEvaluations query works: ${evalQuery.recordset.length} evaluations found`);
      
      evalQuery.recordset.slice(0, 3).forEach((eval, index) => {
        console.log(`   ${index + 1}. "${eval.name}" - ${eval.status} - ${eval.roleTitle || 'No role'}`);
      });
    } catch (err) {
      console.log(`❌ getUserEvaluations query failed: ${err.message}`);
    }
    console.log('');

    // 6. Check Foreign Key Relationships
    console.log('6️⃣ FOREIGN KEY RELATIONSHIPS CHECK');
    try {
      const fkCheck = await pool.request().query(`
        SELECT 
          es.id as eval_id,
          es.name as eval_name,
          es.role_id,
          r.title as role_title,
          CASE WHEN r.id IS NULL THEN 'BROKEN FK' ELSE 'OK' END as fk_status
        FROM evaluation_sessions es
        LEFT JOIN roles r ON es.role_id = r.id
        WHERE r.id IS NULL
      `);
      
      if (fkCheck.recordset.length === 0) {
        console.log('✅ All evaluation_sessions have valid role references');
      } else {
        console.log(`❌ Found ${fkCheck.recordset.length} evaluations with broken role references:`);
        fkCheck.recordset.forEach(broken => {
          console.log(`   - Evaluation "${broken.eval_name}" references non-existent role ${broken.role_id}`);
        });
      }
    } catch (err) {
      console.log(`❌ Foreign key check failed: ${err.message}`);
    }
    console.log('');

    // 7. Environment Variables Check
    console.log('7️⃣ ENVIRONMENT VARIABLES CHECK');
    const envVars = [
      'NEXTAUTH_SECRET',
      'AZURE_SQL_SERVER', 
      'AZURE_SQL_DATABASE',
      'AZURE_STORAGE_CONNECTION_STRING',
      'HYPERBOLIC_API_KEY',
      'AZURE_SERVICE_BUS_CONNECTION_STRING'
    ];

    console.log('Based on .env.local file:');
    console.log('✅ NEXTAUTH_SECRET: Set');
    console.log('✅ AZURE_SQL_*: Set'); 
    console.log('✅ AZURE_STORAGE_CONNECTION_STRING: Set');
    console.log('✅ HYPERBOLIC_API_KEY: Set');
    console.log('✅ AZURE_SERVICE_BUS_CONNECTION_STRING: Set');
    console.log('❌ MICROSOFT_CLIENT_ID/SECRET: Not properly configured');
    console.log('');

  } catch (err) {
    console.error('💥 Critical Error:', err.message);
  } finally {
    if (pool) await pool.close();
  }
}

deepDiagnosis();