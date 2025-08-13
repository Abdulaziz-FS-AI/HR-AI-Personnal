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

async function fixSchema() {
  console.log('🔧 FIXING DATABASE SCHEMA');
  console.log('=========================\n');

  let pool;
  try {
    pool = await sql.connect(config);
    
    // 1. Add missing updated_at column to evaluation_sessions
    console.log('1️⃣ Adding updated_at column to evaluation_sessions...');
    try {
      await pool.request().query(`
        ALTER TABLE evaluation_sessions 
        ADD updated_at datetime2 NULL
      `);
      console.log('✅ Added updated_at column to evaluation_sessions');
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('Invalid column name')) {
        console.log('✅ updated_at column already exists or handled');
      } else {
        throw err;
      }
    }

    // 2. Set updated_at = created_at for existing records
    console.log('2️⃣ Setting updated_at for existing records...');
    const updateResult = await pool.request().query(`
      UPDATE evaluation_sessions 
      SET updated_at = created_at 
      WHERE updated_at IS NULL
    `);
    console.log(`✅ Updated ${updateResult.rowsAffected[0]} records`);

    // 3. Check if evaluation_files table needs updated_at too
    console.log('3️⃣ Checking evaluation_files table...');
    const fileTableCheck = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'evaluation_files' AND COLUMN_NAME = 'updated_at'
    `);
    
    if (fileTableCheck.recordset.length === 0) {
      console.log('   Adding updated_at column to evaluation_files...');
      await pool.request().query(`
        ALTER TABLE evaluation_files 
        ADD updated_at datetime2 NULL
      `);
      
      // Set initial values
      await pool.request().query(`
        UPDATE evaluation_files 
        SET updated_at = created_at 
        WHERE updated_at IS NULL
      `);
      console.log('✅ Fixed evaluation_files table');
    } else {
      console.log('✅ evaluation_files table already has updated_at');
    }

    // 4. Verify the fix
    console.log('4️⃣ Verifying fix...');
    const verifyQuery = await pool.request().query(`
      SELECT 
        es.id,
        es.name,
        es.created_at,
        es.updated_at,
        r.title as roleTitle
      FROM evaluation_sessions es
      LEFT JOIN roles r ON es.role_id = r.id
      ORDER BY es.created_at DESC
    `);
    
    console.log(`✅ Query now works! Found ${verifyQuery.recordset.length} evaluation sessions`);
    if (verifyQuery.recordset.length > 0) {
      verifyQuery.recordset.slice(0, 2).forEach((eval, index) => {
        console.log(`   ${index + 1}. "${eval.name}" - Created: ${eval.created_at}, Updated: ${eval.updated_at}`);
      });
    }

    console.log('\n🎉 SCHEMA FIX COMPLETE!');
    console.log('The /api/evaluations endpoint should now work properly.');

  } catch (err) {
    console.error('💥 Schema Fix Error:', err.message);
  } finally {
    if (pool) await pool.close();
  }
}

fixSchema();