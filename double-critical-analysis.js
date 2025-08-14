const sql = require('mssql');
const fs = require('fs');

console.log('🔬 DOUBLE CRITICAL ANALYSIS: CODE + AZURE');
console.log('==========================================\n');

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

async function doubleCriticalAnalysis() {
  console.log('🔍 PHASE 1: AZURE INFRASTRUCTURE ANALYSIS');
  console.log('==========================================');
  
  let pool;
  try {
    pool = await sql.connect(config);
    console.log('✅ Azure SQL Database connection successful');
    
    // 1. Check if the user that should be authenticated exists
    console.log('\n1️⃣ USER AUTHENTICATION DATA CHECK');
    console.log('==================================');
    
    const users = await pool.request().query(`
      SELECT 
        id,
        email,
        password_hash,
        first_name,
        last_name,
        subscription_tier,
        is_active,
        created_at
      FROM users
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${users.recordset.length} users in database:`);
    users.recordset.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email}`);
      console.log(`      ID: ${user.id}`);
      console.log(`      Active: ${user.is_active ? 'YES' : 'NO'}`);
      console.log(`      Has Password: ${user.password_hash ? 'YES' : 'NO'}`);
      console.log(`      Tier: ${user.subscription_tier || 'Not set'}`);
      console.log(`      Created: ${user.created_at}`);
      console.log('');
    });
    
    // 2. Check roles ownership
    console.log('2️⃣ ROLES OWNERSHIP CHECK');
    console.log('========================');
    
    const roles = await pool.request().query(`
      SELECT 
        r.id,
        r.title,
        r.user_id,
        u.email as owner_email
      FROM roles r
      LEFT JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `);
    
    console.log(`Found ${roles.recordset.length} roles:`);
    roles.recordset.forEach((role, index) => {
      console.log(`   ${index + 1}. "${role.title}"`);
      console.log(`      Owner: ${role.owner_email || 'ORPHANED - NO OWNER!'}`);
      console.log(`      Role ID: ${role.id}`);
      console.log(`      User ID: ${role.user_id}`);
      console.log('');
    });
    
    // 3. Check evaluation sessions
    console.log('3️⃣ EVALUATION SESSIONS CHECK');
    console.log('============================');
    
    const evaluations = await pool.request().query(`
      SELECT 
        es.id,
        es.name,
        es.user_id,
        es.role_id,
        es.status,
        es.created_at,
        u.email as user_email,
        r.title as role_title
      FROM evaluation_sessions es
      LEFT JOIN users u ON es.user_id = u.id
      LEFT JOIN roles r ON es.role_id = r.id
      ORDER BY es.created_at DESC
    `);
    
    if (evaluations.recordset.length === 0) {
      console.log('❌ NO EVALUATION SESSIONS FOUND - This explains why the page shows empty!');
    } else {
      console.log(`Found ${evaluations.recordset.length} evaluation sessions:`);
      evaluations.recordset.forEach((eval, index) => {
        console.log(`   ${index + 1}. "${eval.name}"`);
        console.log(`      User: ${eval.user_email}`);
        console.log(`      Role: ${eval.role_title}`);
        console.log(`      Status: ${eval.status}`);
        console.log(`      Created: ${eval.created_at}`);
        console.log('');
      });
    }
    
  } catch (err) {
    console.error('❌ Azure Database Error:', err.message);
  } finally {
    if (pool) await pool.close();
  }
  
  console.log('\n🔍 PHASE 2: CODE CONFIGURATION ANALYSIS');
  console.log('=======================================');
  
  // 4. Environment Variables Critical Check
  console.log('4️⃣ ENVIRONMENT VARIABLES CRITICAL CHECK');
  console.log('=======================================');
  
  try {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    
    // Critical auth variables
    const criticalVars = {
      'NEXTAUTH_SECRET': { required: true, minLength: 32 },
      'NEXTAUTH_URL': { required: true, shouldContain: 'vercel.app' },
      'GOOGLE_CLIENT_ID': { required: true, minLength: 50 },
      'GOOGLE_CLIENT_SECRET': { required: true, minLength: 20 },
      'AZURE_SQL_SERVER': { required: true, shouldContain: 'database.windows.net' },
      'AZURE_SQL_DATABASE': { required: true },
      'AZURE_SQL_USER': { required: true },
      'AZURE_SQL_PASSWORD': { required: true }
    };
    
    for (const [varName, rules] of Object.entries(criticalVars)) {
      const match = envContent.match(new RegExp(`${varName}=(.*)$`, 'm'));
      const value = match?.[1]?.trim() || '';
      
      if (!value) {
        console.log(`❌ ${varName}: MISSING OR EMPTY`);
      } else if (rules.minLength && value.length < rules.minLength) {
        console.log(`❌ ${varName}: TOO SHORT (${value.length} chars, need ${rules.minLength})`);
      } else if (rules.shouldContain && !value.includes(rules.shouldContain)) {
        console.log(`❌ ${varName}: DOESN'T CONTAIN "${rules.shouldContain}"`);
      } else {
        console.log(`✅ ${varName}: OK (${value.length} chars)`);
      }
    }
    
  } catch (err) {
    console.log(`❌ Environment file error: ${err.message}`);
  }
  
  console.log('\n5️⃣ NEXTAUTH VERSION CHECK');
  console.log('=========================');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const nextAuthVersion = packageJson.dependencies['next-auth'] || packageJson.devDependencies?.['next-auth'];
    
    console.log(`NextAuth version: ${nextAuthVersion}`);
    
    if (nextAuthVersion && nextAuthVersion.includes('beta')) {
      console.log('⚠️  WARNING: Using BETA version of NextAuth - this could cause issues!');
    } else {
      console.log('✅ NextAuth version looks stable');
    }
    
    // Check other critical versions
    console.log(`Next.js version: ${packageJson.dependencies.next}`);
    console.log(`React version: ${packageJson.dependencies.react}`);
    console.log(`MSSQL version: ${packageJson.dependencies.mssql}`);
    
  } catch (err) {
    console.log(`❌ Package.json error: ${err.message}`);
  }
  
  console.log('\n6️⃣ AUTHENTICATION CODE STRUCTURE CHECK');
  console.log('======================================');
  
  // Check critical auth files
  const criticalFiles = [
    'src/lib/auth.ts',
    'src/app/api/auth/[...nextauth]/route.ts',
    'src/middleware.ts',
    'src/lib/security/user-context.ts'
  ];
  
  criticalFiles.forEach(file => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      console.log(`✅ ${file}: EXISTS (${content.length} chars)`);
      
      // Check for common issues
      if (file.includes('auth.ts')) {
        if (content.includes('export const { handlers, auth }')) {
          console.log('   ✅ Exports handlers and auth correctly');
        } else {
          console.log('   ❌ Missing proper exports');
        }
      }
      
      if (file.includes('middleware.ts')) {
        if (content.includes('checkForAuthSession')) {
          console.log('   ✅ Has session checking function');
        } else {
          console.log('   ❌ Missing session checking');
        }
      }
      
    } catch (err) {
      console.log(`❌ ${file}: MISSING OR ERROR - ${err.message}`);
    }
  });
  
  console.log('\n🎯 CRITICAL ANALYSIS SUMMARY');
  console.log('============================');
  console.log('Key findings:');
  console.log('1. Check if user authentication data exists in Azure');
  console.log('2. Verify environment variables are correctly configured');
  console.log('3. Check if NextAuth beta version is causing issues');
  console.log('4. Verify role ownership and permissions');
  console.log('5. Check if evaluation sessions exist (empty = normal for new app)');
}

doubleCriticalAnalysis();