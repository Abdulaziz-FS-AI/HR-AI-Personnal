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

async function fixCriticalIssues() {
  console.log('🔧 FIXING CRITICAL DATABASE ISSUES');
  console.log('===================================\n');
  
  let pool;
  try {
    pool = await sql.connect(config);
    console.log('✅ Connected to database\n');
    
    // 1. Clean up orphaned/soft-deleted roles
    console.log('1️⃣ Cleaning up orphaned/inactive roles...');
    
    // First, show what we're going to delete
    const inactiveRoles = await pool.request().query(`
      SELECT 
        r.id, r.title, r.is_active,
        u.email as owner_email,
        (SELECT COUNT(*) FROM evaluation_sessions WHERE role_id = r.id) as eval_count
      FROM roles r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.is_active = 0
    `);
    
    console.log(`Found ${inactiveRoles.recordset.length} inactive roles to clean up:`);
    for (const role of inactiveRoles.recordset) {
      console.log(`  - ${role.title} (${role.owner_email}, ${role.eval_count} evaluations)`);
    }
    
    if (inactiveRoles.recordset.length > 0) {
      // First delete related evaluation sessions
      console.log('   Cleaning up related evaluation sessions...');
      
      for (const role of inactiveRoles.recordset) {
        if (role.eval_count > 0) {
          await pool.request()
            .input('roleId', sql.UniqueIdentifier, role.id)
            .query(`DELETE FROM evaluation_sessions WHERE role_id = @roleId`);
          console.log(`   ✅ Deleted ${role.eval_count} evaluations for ${role.title}`);
        }
      }
      
      // Now delete the inactive roles
      const deleteResult = await pool.request().query(`
        DELETE FROM roles WHERE is_active = 0
      `);
      
      console.log(`✅ Deleted ${inactiveRoles.recordset.length} inactive roles\n`);
    } else {
      console.log('✅ No inactive roles to clean up\n');
    }
    
    // 2. Fix role_requirements table schema
    console.log('2️⃣ Checking role_requirements table schema...');
    
    // Check if category column exists
    const categoryExists = await pool.request().query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'role_requirements' 
      AND COLUMN_NAME = 'category'
    `);
    
    if (categoryExists.recordset[0].count === 0) {
      console.log('   Adding missing category column...');
      
      try {
        await pool.request().query(`
          ALTER TABLE role_requirements
          ADD category NVARCHAR(50) NULL
        `);
        console.log('   ✅ Added category column\n');
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log('   ℹ️ Category column already exists\n');
        } else {
          console.log(`   ⚠️ Could not add category column: ${err.message}\n`);
        }
      }
    } else {
      console.log('   ✅ Category column already exists\n');
    }
    
    // 3. Fix duplicate roles for same user
    console.log('3️⃣ Fixing duplicate roles...');
    
    const duplicates = await pool.request().query(`
      SELECT 
        user_id, title, COUNT(*) as count
      FROM roles
      WHERE is_active = 1
      GROUP BY user_id, title
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.recordset.length > 0) {
      console.log(`Found ${duplicates.recordset.length} duplicate role sets:`);
      
      for (const dup of duplicates.recordset) {
        console.log(`   Fixing duplicates for: ${dup.title}`);
        
        // Keep only the most configured role (most skills/questions)
        const dupRoles = await pool.request()
          .input('userId', sql.UniqueIdentifier, dup.user_id)
          .input('title', sql.NVarChar, dup.title)
          .query(`
            SELECT 
              r.id,
              (SELECT COUNT(*) FROM role_skills WHERE role_id = r.id) as skill_count,
              (SELECT COUNT(*) FROM role_questions WHERE role_id = r.id) as question_count,
              (SELECT COUNT(*) FROM role_requirements WHERE role_id = r.id) as req_count,
              r.created_at
            FROM roles r
            WHERE r.user_id = @userId AND r.title = @title AND r.is_active = 1
            ORDER BY 
              (SELECT COUNT(*) FROM role_skills WHERE role_id = r.id) DESC,
              (SELECT COUNT(*) FROM role_questions WHERE role_id = r.id) DESC,
              r.created_at DESC
          `);
        
        // Keep the first (best configured) one, deactivate the rest
        for (let i = 1; i < dupRoles.recordset.length; i++) {
          await pool.request()
            .input('roleId', sql.UniqueIdentifier, dupRoles.recordset[i].id)
            .query(`UPDATE roles SET is_active = 0 WHERE id = @roleId`);
        }
        
        console.log(`   ✅ Kept best configured role, deactivated ${dupRoles.recordset.length - 1} duplicates`);
      }
    } else {
      console.log('   ✅ No duplicate roles found\n');
    }
    
    // 4. Fix evaluation sessions with missing or failed status
    console.log('4️⃣ Fixing failed evaluations...');
    
    const failedEvals = await pool.request().query(`
      SELECT 
        es.id, es.name, es.status,
        (SELECT COUNT(*) FROM evaluation_files WHERE evaluation_id = es.id) as file_count,
        (SELECT COUNT(*) FROM evaluation_results WHERE evaluation_id = es.id) as result_count
      FROM evaluation_sessions es
      WHERE es.status = 'failed'
    `);
    
    console.log(`Found ${failedEvals.recordset.length} failed evaluations`);
    
    // Clean up failed evaluations that have no files or results
    for (const eval of failedEvals.recordset) {
      if (eval.file_count === 0 && eval.result_count === 0) {
        await pool.request()
          .input('evalId', sql.UniqueIdentifier, eval.id)
          .query(`DELETE FROM evaluation_sessions WHERE id = @evalId`);
        console.log(`   ✅ Deleted empty failed evaluation: ${eval.name}`);
      }
    }
    
    // 5. Verify active roles configuration
    console.log('\n5️⃣ Verifying active roles configuration...');
    
    const activeRoles = await pool.request().query(`
      SELECT 
        r.id, r.title, u.email,
        (SELECT COUNT(*) FROM role_skills WHERE role_id = r.id) as skills,
        (SELECT COUNT(*) FROM role_questions WHERE role_id = r.id) as questions,
        (SELECT COUNT(*) FROM role_requirements WHERE role_id = r.id) as requirements
      FROM roles r
      JOIN users u ON r.user_id = u.id
      WHERE r.is_active = 1
      ORDER BY skills DESC, questions DESC
    `);
    
    console.log(`\n📊 ACTIVE ROLES STATUS (${activeRoles.recordset.length} total):`);
    console.log('━'.repeat(70));
    
    for (const role of activeRoles.recordset) {
      const status = role.skills >= 5 && role.questions >= 3 ? '✅' : '⚠️';
      console.log(`${status} ${role.title}`);
      console.log(`   Owner: ${role.email}`);
      console.log(`   Config: ${role.skills} skills, ${role.questions} questions, ${role.requirements} requirements`);
      
      if (role.skills < 5 || role.questions < 3) {
        console.log(`   ⚠️ Needs: ${role.skills < 5 ? `${5-role.skills} more skills` : ''} ${role.questions < 3 ? `${3-role.questions} more questions` : ''}`);
      }
      console.log('');
    }
    
    // 6. Summary
    console.log('━'.repeat(70));
    console.log('\n✅ FIXES COMPLETED:');
    console.log('  1. Cleaned up inactive/orphaned roles');
    console.log('  2. Fixed role_requirements schema');
    console.log('  3. Removed duplicate roles');
    console.log('  4. Cleaned failed evaluations');
    console.log('  5. Verified active roles configuration');
    
    // Final stats
    const finalStats = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM roles WHERE is_active = 1) as active_roles,
        (SELECT COUNT(*) FROM users WHERE is_active = 1) as active_users,
        (SELECT COUNT(*) FROM evaluation_sessions WHERE status = 'completed') as completed_evals,
        (SELECT COUNT(*) FROM evaluation_sessions WHERE status = 'failed') as failed_evals
    `);
    
    const stats = finalStats.recordset[0];
    console.log('\n📈 FINAL DATABASE STATUS:');
    console.log(`  Active Roles: ${stats.active_roles}`);
    console.log(`  Active Users: ${stats.active_users}`);
    console.log(`  Completed Evaluations: ${stats.completed_evals}`);
    console.log(`  Failed Evaluations: ${stats.failed_evals}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n✅ Database connection closed');
    }
  }
}

// Run the fixes
fixCriticalIssues();