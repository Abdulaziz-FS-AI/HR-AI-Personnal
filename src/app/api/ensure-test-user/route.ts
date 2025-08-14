import { NextResponse } from 'next/server'
import { getDbConnection } from '@/lib/db'
import sql from 'mssql'

export async function GET() {
  let pool: sql.ConnectionPool | null = null
  
  try {
    pool = await getDbConnection()
    
    const testUserId = '550e8400-e29b-41d4-a716-446655440001'
    
    // Check if test user exists
    const checkUser = await pool.request()
      .input('userId', sql.UniqueIdentifier, testUserId)
      .query('SELECT id FROM users WHERE id = @userId')
    
    if (checkUser.recordset.length === 0) {
      // Get existing user with test@example.com or create with different email
      const existingUser = await pool.request()
        .input('email', sql.NVarChar, 'test@example.com')
        .query('SELECT id FROM users WHERE email = @email')
      
      if (existingUser.recordset.length > 0) {
        // User with email exists but different ID
        return NextResponse.json({
          success: true,
          message: 'Test user exists with different ID',
          userId: existingUser.recordset[0].id,
          note: 'Update test endpoints to use this ID'
        })
      } else {
        // Create new test user
        const testEmail = `test_${Date.now()}@example.com`
        await pool.request()
          .input('userId', sql.UniqueIdentifier, testUserId)
          .input('email', sql.NVarChar, testEmail)
          .input('firstName', sql.NVarChar, 'Test')
          .input('lastName', sql.NVarChar, 'User')
          .input('passwordHash', sql.NVarChar, 'test_hash')
          .query(`
            INSERT INTO users (
              id, email, first_name, last_name, password_hash, 
              created_at, updated_at, is_active
            )
            VALUES (
              @userId, @email, @firstName, @lastName, @passwordHash,
              GETDATE(), GETDATE(), 1
            )
          `)
        
        return NextResponse.json({
          success: true,
          message: 'Test user created',
          userId: testUserId,
          email: testEmail
        })
      }
    } else {
      return NextResponse.json({
        success: true,
        message: 'Test user already exists',
        userId: testUserId
      })
    }
    
  } catch (error) {
    console.error('Ensure test user error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  } finally {
    if (pool) {
      await pool.close()
    }
  }
}