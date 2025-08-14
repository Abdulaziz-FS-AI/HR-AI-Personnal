const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// PART 1: ENVIRONMENT ANALYSIS
console.log('🔬 ULTIMATE PROJECT DIAGNOSIS');
console.log('===============================\n');

// Check project structure
console.log('1️⃣ PROJECT STRUCTURE ANALYSIS');
console.log('==============================');

const criticalPaths = [
  'src/app/api/evaluations/route.ts',
  'src/app/(dashboard)/evaluations/page.tsx',
  'src/app/(dashboard)/evaluations/create/page.tsx',
  'src/lib/auth.ts',
  'src/lib/security/user-context.ts',
  'src/middleware.ts',
  '.env.local'
];

criticalPaths.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${filePath} exists`);
  } else {
    console.log(`❌ ${filePath} MISSING`);
  }
});

// Check package.json dependencies
console.log('\n2️⃣ DEPENDENCIES CHECK');
console.log('=====================');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const criticalDeps = ['next', 'react', 'mssql', 'next-auth', '@azure/storage-blob'];
  
  criticalDeps.forEach(dep => {
    if (packageJson.dependencies[dep] || packageJson.devDependencies?.[dep]) {
      console.log(`✅ ${dep}: ${packageJson.dependencies[dep] || packageJson.devDependencies[dep]}`);
    } else {
      console.log(`❌ ${dep}: MISSING`);
    }
  });
} catch (err) {
  console.log(`❌ package.json read error: ${err.message}`);
}

// PART 2: ENVIRONMENT VARIABLES
console.log('\n3️⃣ ENVIRONMENT VARIABLES');
console.log('========================');
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const envVars = [
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL', 
    'AZURE_SQL_SERVER',
    'AZURE_SQL_DATABASE',
    'AZURE_SQL_USER',
    'AZURE_SQL_PASSWORD',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET'
  ];
  
  envVars.forEach(varName => {
    if (envContent.includes(varName + '=')) {
      const value = envContent.match(new RegExp(varName + '=(.*)$', 'm'))?.[1] || '';
      if (value.trim() && value !== 'your-value-here' && value !== 'undefined') {
        console.log(`✅ ${varName}: SET (${value.length} chars)`);
      } else {
        console.log(`❌ ${varName}: EMPTY OR PLACEHOLDER`);
      }
    } else {
      console.log(`❌ ${varName}: NOT FOUND`);
    }
  });
} catch (err) {
  console.log(`❌ .env.local read error: ${err.message}`);
}

// PART 3: DATABASE TESTING
async function testDatabase() {
  console.log('\n4️⃣ DATABASE CONNECTION & SCHEMA');
  console.log('===============================');
  
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

  let pool;
  try {
    pool = await sql.connect(config);
    console.log('✅ Database connection successful');
    
    // Check critical tables and columns
    const tables = [
      { name: 'users', criticalColumns: ['id', 'email', 'is_active'] },
      { name: 'roles', criticalColumns: ['id', 'title', 'user_id'] },
      { name: 'evaluation_sessions', criticalColumns: ['id', 'user_id', 'role_id', 'updated_at'] },
      { name: 'evaluation_files', criticalColumns: ['id', 'evaluation_id', 'updated_at'] }
    ];
    
    for (const table of tables) {
      try {
        const count = await pool.request().query(`SELECT COUNT(*) as count FROM ${table.name}`);
        console.log(`✅ ${table.name}: ${count.recordset[0].count} records`);
        
        // Check columns exist
        const columns = await pool.request().query(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = '${table.name}'
        `);
        const columnNames = columns.recordset.map(c => c.COLUMN_NAME);
        
        for (const col of table.criticalColumns) {
          if (columnNames.includes(col)) {
            console.log(`  ✅ ${col} column exists`);
          } else {
            console.log(`  ❌ ${col} column MISSING`);
          }
        }
      } catch (err) {
        console.log(`❌ ${table.name}: ${err.message}`);
      }
    }
    
    // Test authentication query
    console.log('\n5️⃣ AUTHENTICATION QUERY TEST');
    console.log('============================');
    const testUserId = '74C57065-8A1B-4175-B3B8-88AD2DDB79AC';
    try {
      const authResult = await pool.request()
        .input('userId', sql.UniqueIdentifier, testUserId)
        .query(`
          SELECT id, email, subscription_tier, is_active
          FROM users 
          WHERE id = @userId AND is_active = 1
        `);
      
      if (authResult.recordset.length > 0) {
        console.log(`✅ Auth query works: ${authResult.recordset[0].email}`);
      } else {
        console.log('❌ Auth query returns no results');
      }
    } catch (err) {
      console.log(`❌ Auth query failed: ${err.message}`);
    }
    
    // Test getUserEvaluations query
    console.log('\n6️⃣ GET_USER_EVALUATIONS QUERY TEST');
    console.log('==================================');
    try {
      const evalResult = await pool.request()
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
      
      console.log(`✅ getUserEvaluations query works: ${evalResult.recordset.length} results`);
    } catch (err) {
      console.log(`❌ getUserEvaluations query failed: ${err.message}`);
    }
    
  } catch (err) {
    console.log(`❌ Database connection failed: ${err.message}`);
  } finally {
    if (pool) await pool.close();
  }
}

// PART 4: CODE ANALYSIS
function analyzeCode() {
  console.log('\n7️⃣ CODE STRUCTURE ANALYSIS');
  console.log('==========================');
  
  // Check API route
  try {
    const apiRoute = fs.readFileSync('src/app/api/evaluations/route.ts', 'utf8');
    console.log('✅ /api/evaluations route exists');
    
    // Check for common issues
    if (apiRoute.includes('requireUserContext')) {
      console.log('  ✅ Uses requireUserContext');
    } else {
      console.log('  ❌ Missing requireUserContext');
    }
    
    if (apiRoute.includes('getUserEvaluations')) {
      console.log('  ✅ Calls getUserEvaluations');
    } else {
      console.log('  ❌ Missing getUserEvaluations call');
    }
    
    if (apiRoute.includes('withRateLimit')) {
      console.log('  ✅ Has rate limiting');
    } else {
      console.log('  ❌ Missing rate limiting');
    }
    
  } catch (err) {
    console.log(`❌ API route analysis failed: ${err.message}`);
  }
  
  // Check middleware
  try {
    const middleware = fs.readFileSync('src/middleware.ts', 'utf8');
    console.log('✅ Middleware exists');
    
    if (middleware.includes('/api/evaluations') || middleware.includes('publicRoutes')) {
      console.log('  ✅ Has route protection logic');
    } else {
      console.log('  ❌ Missing route protection');
    }
    
  } catch (err) {
    console.log(`❌ Middleware analysis failed: ${err.message}`);
  }
  
  // Check auth config
  try {
    const authConfig = fs.readFileSync('src/lib/auth.ts', 'utf8');
    console.log('✅ Auth config exists');
    
    if (authConfig.includes('GoogleProvider')) {
      console.log('  ✅ Has Google OAuth');
    } else {
      console.log('  ❌ Missing Google OAuth');
    }
    
    if (authConfig.includes('CredentialsProvider')) {
      console.log('  ✅ Has credentials auth');
    } else {
      console.log('  ❌ Missing credentials auth');
    }
    
  } catch (err) {
    console.log(`❌ Auth config analysis failed: ${err.message}`);
  }
}

// Run all tests
async function runAllTests() {
  analyzeCode();
  await testDatabase();
  
  console.log('\n🎯 SUMMARY & NEXT STEPS');
  console.log('=======================');
  console.log('If all tests above show ✅, the issue might be:');
  console.log('1. Session/cookie problems in the browser');
  console.log('2. Vercel deployment environment differences');
  console.log('3. NextAuth configuration issues');
  console.log('4. Rate limiting blocking requests');
  console.log('5. Caching issues in Vercel edge functions');
}

runAllTests();