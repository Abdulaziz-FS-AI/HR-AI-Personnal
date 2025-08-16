const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

console.log('🧪 TESTING DATABASE CONNECTION');
console.log('==============================\n');

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

console.log('📋 Configuration:');
console.log(`   Server: ${config.server}`);
console.log(`   Database: ${config.database}`);
console.log(`   User: ${config.user}`);
console.log(`   Password: ${config.password ? 'Set (hidden)' : 'Not set'}`);

async function testDatabase() {
  let pool;
  try {
    console.log('\n🔍 Testing database connection...');
    
    pool = await sql.connect(config);
    console.log('✅ Database connection established');
    
    // Test basic query
    console.log('\n📊 Testing basic query...');
    const result = await pool.request().query('SELECT 1 as test');
    console.log(`✅ Basic query works: ${result.recordset[0].test}`);
    
    // Check evaluation tables
    console.log('\n📋 Checking evaluation tables...');
    const tables = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('evaluation_sessions', 'evaluation_files', 'evaluation_results')
      ORDER BY TABLE_NAME
    `);
    
    console.log(`✅ Found ${tables.recordset.length}/3 evaluation tables:`);
    for (const table of tables.recordset) {
      console.log(`   - ${table.TABLE_NAME}`);
    }
    
    // Check recent evaluations
    console.log('\n📈 Checking recent evaluations...');
    const evaluations = await pool.request().query(`
      SELECT TOP 3 id, name, status, total_files, processed_files, created_at
      FROM evaluation_sessions
      ORDER BY created_at DESC
    `);
    
    console.log(`✅ Found ${evaluations.recordset.length} recent evaluations:`);
    for (const eval of evaluations.recordset) {
      console.log(`   - ${eval.name}: ${eval.status} (${eval.processed_files}/${eval.total_files} files)`);
    }
    
    console.log('\n✅ Database: WORKING');
    
  } catch (error) {
    console.log('❌ Database test failed:', error.message);
    if (error.code) {
      console.log(`   Error code: ${error.code}`);
    }
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

testDatabase();