const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

console.log('🔍 COMPREHENSIVE SYSTEM HEALTH CHECK');
console.log('====================================\n');

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false }
};

async function checkSystemHealth() {
  try {
    console.log('1. 🔗 DATABASE CONNECTION TEST');
    console.log('------------------------------');
    
    const pool = await sql.connect(config);
    console.log('✅ Database connected successfully');
    
    // Check if all required tables exist
    console.log('\n2. 📋 DATABASE SCHEMA VERIFICATION');
    console.log('-----------------------------------');
    
    const tables = await pool.request().query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('Existing Tables:');
    const tableNames = tables.recordset.map(t => t.table_name);
    tableNames.forEach(name => console.log(`   ✅ ${name}`));
    
    // Check required tables
    const requiredTables = [
      'users', 'roles', 'role_skills', 'role_questions', 
      'role_requirements', 'evaluation_sessions', 
      'evaluation_files', 'evaluation_results'
    ];
    
    console.log('\nMissing Required Tables:');
    const missingTables = requiredTables.filter(table => !tableNames.includes(table));
    
    if (missingTables.length === 0) {
      console.log('   ✅ All required tables exist');
    } else {
      console.log('   🚨 CRITICAL: Missing tables detected!');
      missingTables.forEach(table => console.log(`   ❌ ${table}`));
    }
    
    // Check users table structure specifically
    if (tableNames.includes('users')) {
      console.log('\n3. 👤 USERS TABLE ANALYSIS');
      console.log('---------------------------');
      
      const userCols = await pool.request().query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      
      console.log('Users Table Structure:');
      userCols.recordset.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'required'})`);
      });
      
      // Check user count
      const userCount = await pool.request().query('SELECT COUNT(*) as count FROM users');
      console.log(`\nUser Count: ${userCount.recordset[0].count}`);
      
      if (userCount.recordset[0].count > 0) {
        const recentUsers = await pool.request().query(`
          SELECT TOP 3 id, email, first_name, last_name, created_at, is_active
          FROM users 
          ORDER BY created_at DESC
        `);
        
        console.log('Recent Users:');
        recentUsers.recordset.forEach(user => {
          console.log(`   📧 ${user.email} (${user.first_name} ${user.last_name}) - Active: ${user.is_active}`);
        });
      }
    } else {
      console.log('\n🚨 CRITICAL: Users table does not exist!');
    }
    
    // Check roles table
    if (tableNames.includes('roles')) {
      console.log('\n4. 💼 ROLES TABLE ANALYSIS');
      console.log('--------------------------');
      
      const roleCount = await pool.request().query('SELECT COUNT(*) as count FROM roles');
      console.log(`Role Count: ${roleCount.recordset[0].count}`);
    }
    
    console.log('\n5. 🔐 ENVIRONMENT VARIABLES CHECK');
    console.log('----------------------------------');
    
    const envVars = [
      'AZURE_SQL_SERVER', 'AZURE_SQL_DATABASE', 'AZURE_SQL_USER', 'AZURE_SQL_PASSWORD',
      'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
      'AZURE_STORAGE_ACCOUNT_NAME', 'AZURE_STORAGE_ACCOUNT_KEY', 'HYPERBOLIC_API_KEY'
    ];
    
    envVars.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        const displayValue = varName.includes('SECRET') || varName.includes('PASSWORD') || varName.includes('KEY') 
          ? `${value.substring(0, 10)}...` 
          : value;
        console.log(`   ✅ ${varName}: ${displayValue}`);
      } else {
        console.log(`   ❌ ${varName}: MISSING`);
      }
    });
    
    await pool.close();
    
    console.log('\n6. 🎯 DIAGNOSIS & RECOMMENDATIONS');
    console.log('----------------------------------');
    
    if (missingTables.length > 0) {
      console.log('🚨 CRITICAL ISSUE: Database schema incomplete');
      console.log('   Solution: Run schema deployment endpoint');
      console.log('   Command: Visit /api/deploy-complete-schema');
    }
    
    if (userCount && userCount.recordset[0].count === 0) {
      console.log('⚠️  WARNING: No users in database');
      console.log('   Solution: Create account via Google OAuth or registration');
    }
    
    console.log('\n✅ SYSTEM HEALTH CHECK COMPLETED');
    
  } catch (error) {
    console.error('\n❌ SYSTEM CHECK FAILED:', error.message);
    console.error('Full error:', error);
  }
}

checkSystemHealth();