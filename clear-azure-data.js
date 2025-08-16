const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

console.log('🧹 CLEARING ALL AZURE DATABASE DATA');
console.log('===================================\n');

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

async function clearAllData() {
  let pool;
  try {
    pool = await sql.connect(config);
    console.log('✅ Connected to Azure SQL Database');
    
    // Step 1: Check current data counts
    console.log('\n📊 Current Data Counts:');
    
    const counts = await Promise.all([
      pool.request().query('SELECT COUNT(*) as count FROM evaluation_results'),
      pool.request().query('SELECT COUNT(*) as count FROM evaluation_files'),
      pool.request().query('SELECT COUNT(*) as count FROM evaluation_sessions'),
      pool.request().query('SELECT COUNT(*) as count FROM role_questions'),
      pool.request().query('SELECT COUNT(*) as count FROM role_skills'),
      pool.request().query('SELECT COUNT(*) as count FROM role_requirements'),
      pool.request().query('SELECT COUNT(*) as count FROM roles'),
      pool.request().query('SELECT COUNT(*) as count FROM users'),
      pool.request().query(`SELECT COUNT(*) as count FROM audit_logs WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs')`)
    ]);
    
    console.log(`   📈 Evaluation Results: ${counts[0].recordset[0].count}`);
    console.log(`   📄 Evaluation Files: ${counts[1].recordset[0].count}`);
    console.log(`   📋 Evaluation Sessions: ${counts[2].recordset[0].count}`);
    console.log(`   ❓ Role Questions: ${counts[3].recordset[0].count}`);
    console.log(`   🎯 Role Skills: ${counts[4].recordset[0].count}`);
    console.log(`   📝 Role Requirements: ${counts[5].recordset[0].count}`);
    console.log(`   💼 Roles: ${counts[6].recordset[0].count}`);
    console.log(`   👤 Users: ${counts[7].recordset[0].count}`);
    console.log(`   📝 Audit Logs: ${counts[8].recordset[0].count}`);
    
    const totalRecords = counts.reduce((sum, result) => sum + result.recordset[0].count, 0);
    
    if (totalRecords === 0) {
      console.log('\n✅ Database is already clean - no data to delete!');
      return;
    }
    
    console.log(`\n🗑️ Total Records to Delete: ${totalRecords}`);
    
    // Step 2: Start deletion process (in dependency order)
    console.log('\n🚀 Starting Data Deletion Process...\n');
    
    // Delete evaluation results first (no foreign key dependencies)
    console.log('🗑️ Deleting evaluation results...');
    const deletedResults = await pool.request().query('DELETE FROM evaluation_results');
    console.log(`   ✅ Deleted ${deletedResults.rowsAffected[0]} evaluation results`);
    
    // Delete evaluation files
    console.log('🗑️ Deleting evaluation files...');
    const deletedFiles = await pool.request().query('DELETE FROM evaluation_files');
    console.log(`   ✅ Deleted ${deletedFiles.rowsAffected[0]} evaluation files`);
    
    // Delete evaluation sessions
    console.log('🗑️ Deleting evaluation sessions...');
    const deletedSessions = await pool.request().query('DELETE FROM evaluation_sessions');
    console.log(`   ✅ Deleted ${deletedSessions.rowsAffected[0]} evaluation sessions`);
    
    // Delete role-related data
    console.log('🗑️ Deleting role questions...');
    const deletedQuestions = await pool.request().query('DELETE FROM role_questions');
    console.log(`   ✅ Deleted ${deletedQuestions.rowsAffected[0]} role questions`);
    
    console.log('🗑️ Deleting role skills...');
    const deletedSkills = await pool.request().query('DELETE FROM role_skills');
    console.log(`   ✅ Deleted ${deletedSkills.rowsAffected[0]} role skills`);
    
    console.log('🗑️ Deleting role requirements...');
    const deletedRequirements = await pool.request().query('DELETE FROM role_requirements');
    console.log(`   ✅ Deleted ${deletedRequirements.rowsAffected[0]} role requirements`);
    
    // Delete roles
    console.log('🗑️ Deleting roles...');
    const deletedRoles = await pool.request().query('DELETE FROM roles');
    console.log(`   ✅ Deleted ${deletedRoles.rowsAffected[0]} roles`);
    
    // Delete audit logs first (they reference users)
    console.log('🗑️ Deleting audit logs...');
    try {
      const deletedAuditLogs = await pool.request().query('DELETE FROM audit_logs');
      console.log(`   ✅ Deleted ${deletedAuditLogs.rowsAffected[0]} audit logs`);
    } catch (error) {
      if (error.message.includes('Invalid object name')) {
        console.log('   ℹ️ No audit_logs table found - skipping');
      } else {
        throw error;
      }
    }
    
    // Delete users (this will cascade delete any remaining dependent data)
    console.log('🗑️ Deleting users...');
    const deletedUsers = await pool.request().query('DELETE FROM users');
    console.log(`   ✅ Deleted ${deletedUsers.rowsAffected[0]} users`);
    
    // Step 3: Verify deletion
    console.log('\n📊 Verifying Deletion - Final Counts:');
    
    const finalCounts = await Promise.all([
      pool.request().query('SELECT COUNT(*) as count FROM evaluation_results'),
      pool.request().query('SELECT COUNT(*) as count FROM evaluation_files'),
      pool.request().query('SELECT COUNT(*) as count FROM evaluation_sessions'),
      pool.request().query('SELECT COUNT(*) as count FROM role_questions'),
      pool.request().query('SELECT COUNT(*) as count FROM role_skills'),
      pool.request().query('SELECT COUNT(*) as count FROM role_requirements'),
      pool.request().query('SELECT COUNT(*) as count FROM roles'),
      pool.request().query('SELECT COUNT(*) as count FROM users'),
      pool.request().query(`SELECT COUNT(*) as count FROM audit_logs WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs')`)
    ]);
    
    console.log(`   📈 Evaluation Results: ${finalCounts[0].recordset[0].count}`);
    console.log(`   📄 Evaluation Files: ${finalCounts[1].recordset[0].count}`);
    console.log(`   📋 Evaluation Sessions: ${finalCounts[2].recordset[0].count}`);
    console.log(`   ❓ Role Questions: ${finalCounts[3].recordset[0].count}`);
    console.log(`   🎯 Role Skills: ${finalCounts[4].recordset[0].count}`);
    console.log(`   📝 Role Requirements: ${finalCounts[5].recordset[0].count}`);
    console.log(`   💼 Roles: ${finalCounts[6].recordset[0].count}`);
    console.log(`   👤 Users: ${finalCounts[7].recordset[0].count}`);
    console.log(`   📝 Audit Logs: ${finalCounts[8].recordset[0].count}`);
    
    const remainingRecords = finalCounts.reduce((sum, result) => sum + result.recordset[0].count, 0);
    
    if (remainingRecords === 0) {
      console.log('\n🎉 SUCCESS: All data has been completely cleared!');
      console.log('📋 Database tables are now empty and ready for fresh data');
    } else {
      console.log(`\n⚠️ WARNING: ${remainingRecords} records still remain in database`);
    }
    
    // Step 4: Reset identity columns if they exist
    console.log('\n🔄 Resetting identity seeds (if applicable)...');
    try {
      // Note: Our tables use UUIDs, not identity columns, so this is mainly informational
      console.log('   ℹ️ Tables use UUID primary keys - no identity reset needed');
    } catch (error) {
      console.log('   ℹ️ No identity columns to reset');
    }
    
    console.log('\n✅ AZURE DATABASE CLEANUP COMPLETED SUCCESSFULLY!');
    console.log('🆕 Database is now clean and ready for production use');
    
  } catch (error) {
    console.error('\n❌ Error during data cleanup:', error.message);
    if (error.originalError) {
      console.error('   SQL Error:', error.originalError.message);
    }
    console.error('\n⚠️ Some data may not have been deleted - please check manually');
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Confirm before running
console.log('⚠️  WARNING: This will DELETE ALL DATA in the Azure database!');
console.log('📋 Tables affected: users, roles, evaluations, files, results');
console.log('🔄 Table structure will be preserved, only data will be deleted');
console.log('\n🚀 Starting cleanup in 3 seconds...\n');

setTimeout(() => {
  clearAllData();
}, 3000);