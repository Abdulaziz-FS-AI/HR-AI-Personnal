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

async function checkUserRoles() {
  console.log('🔍 Checking roles for Abdulaziz Saeed accounts\n');
  console.log('=' .repeat(60));
  
  let pool;
  try {
    pool = await sql.connect(config);
    console.log('✅ Connected to Azure SQL Database\n');
    
    // First, find all users with name "Abdulaziz Saeed"
    const users = await pool.request().query(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        is_active,
        subscription_tier,
        created_at
      FROM users
      WHERE first_name LIKE '%Abdulaziz%' 
         OR last_name LIKE '%Saeed%'
         OR email LIKE '%abdulaziz%'
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${users.recordset.length} Abdulaziz-related accounts:\n`);
    
    for (const user of users.recordset) {
      console.log(`👤 User: ${user.first_name || 'N/A'} ${user.last_name || 'N/A'}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Status: ${user.is_active ? '✅ Active' : '❌ Inactive'}`);
      console.log(`   Tier: ${user.subscription_tier || 'None'}`);
      console.log(`   Joined: ${new Date(user.created_at).toLocaleDateString()}`);
      
      // Get roles for this user
      const roles = await pool.request()
        .input('userId', sql.UniqueIdentifier, user.id)
        .query(`
          SELECT 
            r.id,
            r.title,
            r.description,
            r.department,
            r.location,
            r.employment_type,
            r.seniority_level,
            r.is_active,
            r.created_at,
            (SELECT COUNT(*) FROM role_skills WHERE role_id = r.id) as skill_count,
            (SELECT COUNT(*) FROM role_questions WHERE role_id = r.id) as question_count,
            (SELECT COUNT(*) FROM role_requirements WHERE role_id = r.id) as requirement_count,
            (SELECT COUNT(*) FROM evaluation_sessions WHERE role_id = r.id) as evaluation_count
          FROM roles r
          WHERE r.user_id = @userId
          ORDER BY r.created_at DESC
        `);
      
      if (roles.recordset.length > 0) {
        console.log(`\n   📋 Roles Created (${roles.recordset.length} total):`);
        
        for (const role of roles.recordset) {
          console.log(`\n   🎯 "${role.title}"`);
          console.log(`      ID: ${role.id}`);
          console.log(`      Status: ${role.is_active ? '✅ Active' : '❌ Inactive'}`);
          console.log(`      Department: ${role.department || 'Not specified'}`);
          console.log(`      Location: ${role.location || 'Not specified'}`);
          console.log(`      Type: ${role.employment_type || 'Not specified'}`);
          console.log(`      Level: ${role.seniority_level || 'Not specified'}`);
          console.log(`      Configuration:`);
          console.log(`        - Skills: ${role.skill_count}`);
          console.log(`        - Questions: ${role.question_count}`);
          console.log(`        - Requirements: ${role.requirement_count}`);
          console.log(`      Evaluations Run: ${role.evaluation_count}`);
          console.log(`      Created: ${new Date(role.created_at).toLocaleDateString()}`);
          
          if (role.description) {
            console.log(`      Description: ${role.description.substring(0, 100)}...`);
          }
        }
      } else {
        console.log(`   ❌ No roles created by this user`);
      }
      
      // Check evaluations for this user
      const evaluations = await pool.request()
        .input('userId', sql.UniqueIdentifier, user.id)
        .query(`
          SELECT 
            COUNT(*) as total_evaluations,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
            COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
          FROM evaluation_sessions
          WHERE user_id = @userId
        `);
      
      const evalStats = evaluations.recordset[0];
      if (evalStats.total_evaluations > 0) {
        console.log(`\n   📊 Evaluation Statistics:`);
        console.log(`      Total: ${evalStats.total_evaluations}`);
        console.log(`      Completed: ${evalStats.completed}`);
        console.log(`      Failed: ${evalStats.failed}`);
        console.log(`      Processing: ${evalStats.processing}`);
        console.log(`      Pending: ${evalStats.pending}`);
      }
      
      console.log('\n' + '-'.repeat(60) + '\n');
    }
    
    // Summary
    console.log('📊 SUMMARY:');
    const totalRoles = await pool.request().query(`
      SELECT COUNT(*) as count 
      FROM roles r
      INNER JOIN users u ON r.user_id = u.id
      WHERE u.first_name LIKE '%Abdulaziz%' 
         OR u.last_name LIKE '%Saeed%'
         OR u.email LIKE '%abdulaziz%'
    `);
    
    console.log(`Total roles created by Abdulaziz accounts: ${totalRoles.recordset[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n✅ Database connection closed');
    }
  }
}

checkUserRoles();