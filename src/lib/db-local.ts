import Database from 'better-sqlite3'
import { hash } from 'bcryptjs'
import path from 'path'

// Create local SQLite database
const dbPath = path.join(process.cwd(), 'local-database.db')
const db = new Database(dbPath)

// Initialize tables
export function initDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      company_name TEXT,
      first_name TEXT,
      last_name TEXT,
      credits_remaining INTEGER DEFAULT 1000,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    )
  `)

  // Roles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      responsibilities TEXT,
      department TEXT,
      location TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  // Files table
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_type TEXT NOT NULL,
      blob_name TEXT,
      user_id TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processing_status TEXT DEFAULT 'pending',
      extracted_text TEXT,
      is_archived INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      tags TEXT,
      notes TEXT,
      retry_count INTEGER DEFAULT 0,
      extraction_confidence REAL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  console.log('Local database initialized')
}

// User operations
export interface LocalUser {
  id: string
  email: string
  passwordHash: string
  companyName?: string
  firstName?: string
  lastName?: string
  creditsRemaining: number
  createdAt: string
}

export function createUser(userData: {
  email: string
  passwordHash: string
  firstName?: string
  lastName?: string
  companyName?: string
}): LocalUser | null {
  try {
    const stmt = db.prepare(`
      INSERT INTO users (email, password_hash, first_name, last_name, company_name)
      VALUES (?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      userData.email,
      userData.passwordHash,
      userData.firstName || null,
      userData.lastName || null,
      userData.companyName || null
    )

    if (result.changes > 0) {
      return getUserById(result.lastInsertRowid as string)
    }
    return null
  } catch (error) {
    console.error('Error creating user:', error)
    return null
  }
}

export function getUserByEmail(email: string): LocalUser | null {
  try {
    const stmt = db.prepare(`
      SELECT id, email, password_hash as passwordHash, 
             company_name as companyName, first_name as firstName, 
             last_name as lastName, credits_remaining as creditsRemaining,
             created_at as createdAt
      FROM users WHERE email = ?
    `)
    return stmt.get(email) as LocalUser || null
  } catch (error) {
    console.error('Error getting user by email:', error)
    return null
  }
}

export function getUserById(id: string): LocalUser | null {
  try {
    const stmt = db.prepare(`
      SELECT id, email, password_hash as passwordHash, 
             company_name as companyName, first_name as firstName, 
             last_name as lastName, credits_remaining as creditsRemaining,
             created_at as createdAt
      FROM users WHERE id = ?
    `)
    return stmt.get(id) as LocalUser || null
  } catch (error) {
    console.error('Error getting user by ID:', error)
    return null
  }
}

// Initialize database on import
initDatabase()