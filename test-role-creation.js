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

async function testRoleCreation() {
  console.log('🧪 Testing Role Creation API');
  console.log('============================\n');
  
  let pool;
  try {
    pool = await sql.connect(config);
    console.log('✅ Connected to database\n');
    
    // Get test user
    const users = await pool.request().query(`
      SELECT TOP 1 id, email FROM users 
      WHERE email LIKE '%abdulaziz%'
    `);
    
    if (users.recordset.length === 0) {
      console.error('❌ No test user found');
      return;
    }
    
    const userId = users.recordset[0].id;
    console.log(`👤 Test user: ${users.recordset[0].email}`);
    console.log(`🆔 User ID: ${userId}\n`);
    
    // Test role creation with minimal data
    console.log('📝 Testing role creation...');
    
    const roleId = require('crypto').randomUUID();
    const roleName = `Test Role - ${new Date().toLocaleTimeString()}`;
    
    try {
      const roleResult = await pool.request()
        .input('id', sql.UniqueIdentifier, roleId)
        .input('userId', sql.UniqueIdentifier, userId)
        .input('title', sql.NVarChar, roleName)
        .input('description', sql.NText, 'Test role description')
        .query(`
          INSERT INTO roles (
            id, user_id, title, description,
            is_active, created_at, updated_at
          )
          OUTPUT INSERTED.*
          VALUES (
            @id, @userId, @title, @description,
            1, GETDATE(), GETDATE()
          )
        `);
      
      console.log('✅ Role created successfully!');
      console.log(`   Role ID: ${roleResult.recordset[0].id}`);
      console.log(`   Title: ${roleResult.recordset[0].title}\n`);
      
      // Test adding a requirement (this was causing the error)
      console.log('📋 Testing requirement creation...');
      
      try {
        const reqResult = await pool.request()
          .input('id', sql.UniqueIdentifier, require('crypto').randomUUID())
          .input('roleId', sql.UniqueIdentifier, roleId)
          .input('requirementType', sql.NVarChar, 'experience')
          .input('requirementValue', sql.NVarChar, '3+ years of experience')
          .input('isRequired', sql.Bit, true)
          .input('priority', sql.Int, 8)
          .query(`
            INSERT INTO role_requirements (
              id, role_id, requirement_type, requirement_value, 
              is_required, priority, created_at, updated_at
            )
            OUTPUT INSERTED.*
            VALUES (
              @id, @roleId, @requirementType, @requirementValue,
              @isRequired, @priority, GETDATE(), GETDATE()
            )
          `);
        
        console.log('✅ Requirement created successfully!');
        console.log(`   Type: ${reqResult.recordset[0].requirement_type}`);
        console.log(`   Value: ${reqResult.recordset[0].requirement_value}\n`);
        
      } catch (reqError) {
        console.error('❌ Requirement creation failed:', reqError.message);
        
        // Check if the issue is missing columns
        const columns = await pool.request().query(`
          SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = 'role_requirements'
          ORDER BY ORDINAL_POSITION
        `);
        
        console.log('\n📋 role_requirements table columns:');
        for (const col of columns.recordset) {
          console.log(`   ${col.COLUMN_NAME} (${col.DATA_TYPE}, nullable: ${col.IS_NULLABLE})`);
        }
      }
      
      // Clean up test data
      console.log('\n🧹 Cleaning up test data...');
      await pool.request()
        .input('roleId', sql.UniqueIdentifier, roleId)
        .query(`DELETE FROM role_requirements WHERE role_id = @roleId`);
      
      await pool.request()
        .input('roleId', sql.UniqueIdentifier, roleId)
        .query(`DELETE FROM roles WHERE id = @roleId`);
      
      console.log('✅ Test data cleaned up');
      
    } catch (roleError) {
      console.error('❌ Role creation failed:', roleError.message);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n✅ Database connection closed');
    }
  }
}

testRoleCreation();