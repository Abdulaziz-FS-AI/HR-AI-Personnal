/**
 * Database Schema Verification Script
 * Professional debugging tool to verify actual database structure
 */

require('dotenv').config({ path: '.env.local' })
const sql = require('mssql')

async function verifySchema() {
  const config = {
    server: process.env.AZURE_SQL_SERVER,
    database: process.env.AZURE_SQL_DATABASE,
    user: process.env.AZURE_SQL_USER,
    password: process.env.AZURE_SQL_PASSWORD,
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
    connectionTimeout: 30000,
  }

  try {
    console.log('🔍 DATABASE SCHEMA VERIFICATION')
    console.log('================================')
    
    const pool = await sql.connect(config)
    
    // Get all tables
    const tablesResult = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `)
    
    console.log('\n📊 EXISTING TABLES:')
    console.log('-------------------')
    const tables = tablesResult.recordset.map(r => r.TABLE_NAME)
    tables.forEach(t => console.log(`  ✓ ${t}`))
    
    // Get columns for critical tables
    const criticalTables = [
      'users', 'roles', 'role_skills', 'role_questions',
      'evaluation_sessions', 'evaluation_files', 'evaluation_results'
    ]
    
    console.log('\n📋 TABLE STRUCTURES:')
    console.log('--------------------')
    
    for (const tableName of criticalTables) {
      if (tables.includes(tableName)) {
        const columnsResult = await pool.request()
          .input('tableName', sql.NVarChar, tableName)
          .query(`
            SELECT 
              COLUMN_NAME,
              DATA_TYPE,
              CHARACTER_MAXIMUM_LENGTH,
              IS_NULLABLE,
              COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = @tableName
            ORDER BY ORDINAL_POSITION
          `)
        
        console.log(`\n🔸 ${tableName}:`)
        columnsResult.recordset.forEach(col => {
          const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'
          const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''
          console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE}${length} ${nullable}`)
        })
      } else {
        console.log(`\n❌ TABLE MISSING: ${tableName}`)
      }
    }
    
    // Check for foreign key constraints
    console.log('\n🔗 FOREIGN KEY CONSTRAINTS:')
    console.log('---------------------------')
    
    const fkResult = await pool.request().query(`
      SELECT 
        fk.name AS FK_NAME,
        tp.name AS PARENT_TABLE,
        cp.name AS PARENT_COLUMN,
        tr.name AS REFERENCED_TABLE,
        cr.name AS REFERENCED_COLUMN
      FROM sys.foreign_keys AS fk
      INNER JOIN sys.tables AS tp ON fk.parent_object_id = tp.object_id
      INNER JOIN sys.tables AS tr ON fk.referenced_object_id = tr.object_id
      INNER JOIN sys.foreign_key_columns AS fkc ON fk.object_id = fkc.constraint_object_id
      INNER JOIN sys.columns AS cp ON fkc.parent_column_id = cp.column_id AND fkc.parent_object_id = cp.object_id
      INNER JOIN sys.columns AS cr ON fkc.referenced_column_id = cr.column_id AND fkc.referenced_object_id = cr.object_id
      ORDER BY tp.name, fk.name
    `)
    
    if (fkResult.recordset.length > 0) {
      fkResult.recordset.forEach(fk => {
        console.log(`   ${fk.PARENT_TABLE}.${fk.PARENT_COLUMN} → ${fk.REFERENCED_TABLE}.${fk.REFERENCED_COLUMN}`)
      })
    } else {
      console.log('   No foreign keys found')
    }
    
    await pool.close()
    
    console.log('\n✅ Schema verification complete!')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

verifySchema()