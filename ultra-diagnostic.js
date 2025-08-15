const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

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

console.log(`${colors.cyan}${colors.bright}
╔════════════════════════════════════════════════════════════════╗
║          🔬 ULTRA COMPREHENSIVE PROJECT DIAGNOSTIC 🔬          ║
║                     HR AI SaaS System Check                    ║
╚════════════════════════════════════════════════════════════════╝
${colors.reset}`);

async function runUltraDiagnostic() {
  let pool;
  let issuesFound = [];
  let fixesApplied = [];
  
  try {
    // ========================================
    // SECTION 1: ENVIRONMENT & CONFIG CHECK
    // ========================================
    console.log(`\n${colors.blue}${colors.bright}[1/7] ENVIRONMENT & CONFIGURATION CHECK${colors.reset}`);
    console.log('━'.repeat(60));
    
    // Check .env.local
    try {
      const envContent = fs.readFileSync('.env.local', 'utf8');
      const requiredVars = [
        'NEXTAUTH_SECRET',
        'NEXTAUTH_URL',
        'AZURE_SQL_SERVER',
        'AZURE_SQL_DATABASE', 
        'AZURE_SQL_USER',
        'AZURE_SQL_PASSWORD',
        'HYPERBOLIC_API_KEY',
        'AZURE_STORAGE_CONNECTION_STRING',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET'
      ];
      
      console.log('\n📋 Environment Variables:');
      for (const varName of requiredVars) {
        const hasVar = envContent.includes(`${varName}=`);
        const match = envContent.match(new RegExp(`${varName}=(.*)$`, 'm'));
        const value = match?.[1]?.trim() || '';
        
        if (!hasVar) {
          console.log(`  ${colors.red}✗${colors.reset} ${varName}: MISSING`);
          issuesFound.push(`Missing environment variable: ${varName}`);
        } else if (!value || value === 'your-value-here') {
          console.log(`  ${colors.yellow}⚠${colors.reset} ${varName}: PLACEHOLDER VALUE`);
          issuesFound.push(`Placeholder value for: ${varName}`);
        } else {
          console.log(`  ${colors.green}✓${colors.reset} ${varName}: SET (${value.length} chars)`);
        }
      }
      
      // Check for Hyperbolic API model
      if (envContent.includes('HYPERBOLIC_API_KEY')) {
        console.log(`\n${colors.cyan}🤖 AI Configuration:${colors.reset}`);
        console.log(`  Model: gpt-oss-120b ${colors.green}✓${colors.reset}`);
        console.log(`  Endpoint: https://api.hyperbolic.xyz/v1/chat/completions ${colors.green}✓${colors.reset}`);
      }
      
    } catch (err) {
      console.log(`${colors.red}✗ Cannot read .env.local: ${err.message}${colors.reset}`);
      issuesFound.push('.env.local file not found or not readable');
    }
    
    // ========================================
    // SECTION 2: DATABASE CONNECTION
    // ========================================
    console.log(`\n${colors.blue}${colors.bright}[2/7] DATABASE CONNECTION TEST${colors.reset}`);
    console.log('━'.repeat(60));
    
    pool = await sql.connect(config);
    console.log(`${colors.green}✓ Connected to Azure SQL Database${colors.reset}`);
    
    // ========================================
    // SECTION 3: DATABASE SCHEMA ANALYSIS
    // ========================================
    console.log(`\n${colors.blue}${colors.bright}[3/7] DATABASE SCHEMA ANALYSIS${colors.reset}`);
    console.log('━'.repeat(60));
    
    const tables = await pool.request().query(`
      SELECT TABLE_NAME, 
             (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = t.TABLE_NAME) as column_count
      FROM INFORMATION_SCHEMA.TABLES t
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    console.log(`\n📊 Database Tables (${tables.recordset.length} total):`);
    
    const criticalTables = [
      'users', 'roles', 'role_skills', 'role_questions', 'role_requirements',
      'evaluation_sessions', 'evaluation_files', 'evaluation_results'
    ];
    
    for (const table of criticalTables) {
      const tableInfo = tables.recordset.find(t => t.TABLE_NAME === table);
      if (tableInfo) {
        // Get row count
        const countResult = await pool.request().query(`SELECT COUNT(*) as count FROM ${table}`);
        const rowCount = countResult.recordset[0].count;
        
        if (rowCount === 0) {
          console.log(`  ${colors.yellow}⚠${colors.reset} ${table}: ${tableInfo.column_count} columns, ${colors.yellow}${rowCount} rows (EMPTY)${colors.reset}`);
          if (table !== 'evaluation_results' && table !== 'evaluation_files') {
            issuesFound.push(`Table ${table} is empty`);
          }
        } else {
          console.log(`  ${colors.green}✓${colors.reset} ${table}: ${tableInfo.column_count} columns, ${rowCount} rows`);
        }
      } else {
        console.log(`  ${colors.red}✗${colors.reset} ${table}: MISSING`);
        issuesFound.push(`Critical table missing: ${table}`);
      }
    }
    
    // ========================================
    // SECTION 4: USER & AUTHENTICATION CHECK
    // ========================================
    console.log(`\n${colors.blue}${colors.bright}[4/7] USER & AUTHENTICATION STATUS${colors.reset}`);
    console.log('━'.repeat(60));
    
    const users = await pool.request().query(`
      SELECT id, email, first_name, last_name, is_active, subscription_tier,
             (SELECT COUNT(*) FROM roles WHERE user_id = users.id) as role_count,
             (SELECT COUNT(*) FROM evaluation_sessions WHERE user_id = users.id) as eval_count
      FROM users
      ORDER BY created_at DESC
    `);
    
    console.log(`\n👥 Registered Users (${users.recordset.length} total):`);
    for (const user of users.recordset) {
      const status = user.is_active ? `${colors.green}Active${colors.reset}` : `${colors.red}Inactive${colors.reset}`;
      console.log(`  • ${user.email} - ${status}`);
      console.log(`    Roles: ${user.role_count}, Evaluations: ${user.eval_count}, Tier: ${user.subscription_tier || 'None'}`);
    }
    
    // ========================================
    // SECTION 5: ROLE CONFIGURATION CHECK
    // ========================================
    console.log(`\n${colors.blue}${colors.bright}[5/7] ROLE CONFIGURATION ANALYSIS${colors.reset}`);
    console.log('━'.repeat(60));
    
    const roles = await pool.request().query(`
      SELECT 
        r.id, r.title, r.user_id,
        (SELECT COUNT(*) FROM role_skills WHERE role_id = r.id) as skill_count,
        (SELECT COUNT(*) FROM role_questions WHERE role_id = r.id) as question_count,
        (SELECT COUNT(*) FROM role_requirements WHERE role_id = r.id) as requirement_count,
        (SELECT COUNT(*) FROM evaluation_sessions WHERE role_id = r.id) as evaluation_count
      FROM roles r
      WHERE r.is_active = 1
      ORDER BY r.created_at DESC
    `);
    
    console.log(`\n🎯 Active Roles (${roles.recordset.length} total):`);
    
    let underConfiguredRoles = 0;
    for (const role of roles.recordset.slice(0, 5)) { // Show first 5
      console.log(`\n  📝 "${role.title}"`);
      
      const skillStatus = role.skill_count >= 5 ? colors.green : role.skill_count > 0 ? colors.yellow : colors.red;
      const questionStatus = role.question_count >= 3 ? colors.green : role.question_count > 0 ? colors.yellow : colors.red;
      const reqStatus = role.requirement_count >= 3 ? colors.green : role.requirement_count > 0 ? colors.yellow : colors.red;
      
      console.log(`     Skills: ${skillStatus}${role.skill_count}${colors.reset}, Questions: ${questionStatus}${role.question_count}${colors.reset}, Requirements: ${reqStatus}${role.requirement_count}${colors.reset}`);
      console.log(`     Evaluations Run: ${role.evaluation_count}`);
      
      if (role.skill_count < 5 || role.question_count < 3) {
        underConfiguredRoles++;
      }
    }
    
    if (underConfiguredRoles > 0) {
      issuesFound.push(`${underConfiguredRoles} roles are under-configured (need more skills/questions)`);
    }
    
    // ========================================
    // SECTION 6: EVALUATION PIPELINE STATUS
    // ========================================
    console.log(`\n${colors.blue}${colors.bright}[6/7] EVALUATION PIPELINE STATUS${colors.reset}`);
    console.log('━'.repeat(60));
    
    const evaluations = await pool.request().query(`
      SELECT 
        status, 
        COUNT(*) as count,
        AVG(CASE WHEN average_score IS NOT NULL THEN average_score ELSE 0 END) as avg_score
      FROM evaluation_sessions
      GROUP BY status
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Evaluation Status Distribution:');
    
    let totalEvals = 0;
    let failedEvals = 0;
    
    for (const eval of evaluations.recordset) {
      totalEvals += eval.count;
      if (eval.status === 'failed') failedEvals = eval.count;
      
      const statusColor = 
        eval.status === 'completed' ? colors.green :
        eval.status === 'failed' ? colors.red :
        eval.status === 'processing' ? colors.yellow :
        colors.cyan;
      
      const percentage = ((eval.count / evaluations.recordset.reduce((a, b) => a + b.count, 0)) * 100).toFixed(1);
      console.log(`  ${statusColor}${eval.status.toUpperCase()}${colors.reset}: ${eval.count} (${percentage}%) - Avg Score: ${eval.avg_score?.toFixed(1) || 'N/A'}`);
    }
    
    const failureRate = totalEvals > 0 ? (failedEvals / totalEvals * 100).toFixed(1) : 0;
    if (failureRate > 30) {
      console.log(`\n  ${colors.red}⚠ HIGH FAILURE RATE: ${failureRate}%${colors.reset}`);
      issuesFound.push(`High evaluation failure rate: ${failureRate}%`);
    }
    
    // Check recent failures
    const recentFailures = await pool.request().query(`
      SELECT TOP 5 
        es.name, es.created_at, es.role_id,
        r.title as role_title,
        es.total_files
      FROM evaluation_sessions es
      LEFT JOIN roles r ON es.role_id = r.id
      WHERE es.status = 'failed'
      ORDER BY es.created_at DESC
    `);
    
    if (recentFailures.recordset.length > 0) {
      console.log('\n  Recent Failed Evaluations:');
      for (const failure of recentFailures.recordset) {
        console.log(`    • ${failure.name} (${failure.role_title || 'Unknown Role'})`);
        console.log(`      Files: ${failure.total_files}, Date: ${new Date(failure.created_at).toLocaleDateString()}`);
      }
    }
    
    // ========================================
    // SECTION 7: FILE PROCESSING STATUS
    // ========================================
    console.log(`\n${colors.blue}${colors.bright}[7/7] FILE PROCESSING ANALYSIS${colors.reset}`);
    console.log('━'.repeat(60));
    
    const fileStats = await pool.request().query(`
      SELECT 
        processing_status,
        COUNT(*) as count
      FROM evaluation_files
      GROUP BY processing_status
    `);
    
    if (fileStats.recordset.length > 0) {
      console.log('\n📁 File Processing Status:');
      for (const stat of fileStats.recordset) {
        const statusColor = 
          stat.processing_status === 'completed' ? colors.green :
          stat.processing_status === 'failed' ? colors.red :
          colors.yellow;
        console.log(`  ${statusColor}${stat.processing_status}: ${stat.count} files${colors.reset}`);
      }
    } else {
      console.log('\n  No files processed yet');
    }
    
    // ========================================
    // DIAGNOSIS SUMMARY
    // ========================================
    console.log(`\n${colors.magenta}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.magenta}${colors.bright}📋 DIAGNOSIS SUMMARY${colors.reset}`);
    console.log(`${colors.magenta}${'═'.repeat(60)}${colors.reset}`);
    
    if (issuesFound.length === 0) {
      console.log(`\n${colors.green}${colors.bright}✅ NO CRITICAL ISSUES FOUND!${colors.reset}`);
      console.log('The system appears to be configured correctly.');
    } else {
      console.log(`\n${colors.red}${colors.bright}⚠ ISSUES FOUND (${issuesFound.length}):${colors.reset}`);
      issuesFound.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }
    
    // ========================================
    // RECOMMENDED ACTIONS
    // ========================================
    console.log(`\n${colors.cyan}${colors.bright}🔧 RECOMMENDED ACTIONS:${colors.reset}`);
    
    const recommendations = [];
    
    if (failureRate > 30) {
      recommendations.push('Debug evaluation failures - check Hyperbolic API integration');
    }
    
    if (underConfiguredRoles > 0) {
      recommendations.push('Add more skills and questions to under-configured roles');
    }
    
    const emptyRequirements = roles.recordset.filter(r => r.requirement_count === 0);
    if (emptyRequirements.length > 0) {
      recommendations.push(`Add requirements to ${emptyRequirements.length} roles`);
    }
    
    if (fileStats.recordset.length === 0 || fileStats.recordset.find(s => s.processing_status === 'completed')?.count === 0) {
      recommendations.push('Test file upload and processing pipeline');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('System is ready for testing! Try creating an evaluation.');
    }
    
    recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
    
    // ========================================
    // SYSTEM HEALTH SCORE
    // ========================================
    let healthScore = 100;
    healthScore -= issuesFound.length * 10;
    healthScore -= failureRate > 30 ? 20 : 0;
    healthScore -= underConfiguredRoles * 5;
    healthScore = Math.max(0, healthScore);
    
    const healthColor = 
      healthScore >= 80 ? colors.green :
      healthScore >= 60 ? colors.yellow :
      colors.red;
    
    console.log(`\n${colors.bright}🏥 OVERALL SYSTEM HEALTH: ${healthColor}${healthScore}%${colors.reset}`);
    
    const healthBar = '█'.repeat(Math.floor(healthScore / 5)) + '░'.repeat(20 - Math.floor(healthScore / 5));
    console.log(`   [${healthColor}${healthBar}${colors.reset}]`);
    
    // ========================================
    // QUICK FIX SUGGESTIONS
    // ========================================
    if (issuesFound.length > 0) {
      console.log(`\n${colors.yellow}${colors.bright}💡 QUICK FIXES AVAILABLE:${colors.reset}`);
      console.log('  Run these commands to fix common issues:');
      console.log(`  ${colors.cyan}1. node populate-test-data.js${colors.reset} - Add comprehensive test role`);
      console.log(`  ${colors.cyan}2. npm run build${colors.reset} - Rebuild the application`);
      console.log(`  ${colors.cyan}3. vercel env pull${colors.reset} - Sync environment variables`);
    }
    
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}❌ DIAGNOSTIC ERROR:${colors.reset}`, error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (pool) {
      await pool.close();
      console.log(`\n${colors.green}Database connection closed.${colors.reset}`);
    }
    
    console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}Diagnostic completed at: ${new Date().toLocaleString()}${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);
  }
}

// Run the diagnostic
runUltraDiagnostic();