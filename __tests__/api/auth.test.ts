import { POST } from '@/app/api/auth/register/route'
import { NextRequest } from 'next/server'

// Mock mssql module
jest.mock('mssql', () => ({
  ConnectionPool: jest.fn(),
}))

// Mock the database functions
jest.mock('@/lib/db', () => ({
  getUserByEmail: jest.fn(),
  createUser: jest.fn(),
}))

describe('/api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should register a new user successfully', async () => {
    const { getUserByEmail, createUser } = require('@/lib/db')
    
    getUserByEmail.mockResolvedValue(null) // User doesn't exist
    createUser.mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      companyName: 'Test Company'
    })

    const requestBody = {
      email: 'test@example.com',
      password: 'securePassword123',
      firstName: 'Test',
      lastName: 'User',
      companyName: 'Test Company'
    }

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.message).toBe('User created successfully')
    expect(data.user.id).toBe('test-user-id')
    expect(data.user.email).toBe('test@example.com')
  })

  test('should reject registration with missing fields', async () => {
    const requestBody = {
      email: 'test@example.com',
      // Missing required fields
    }

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.message).toBe('Validation failed')
    expect(data.errors).toBeDefined()
  })

  test('should reject registration with weak password', async () => {
    const requestBody = {
      email: 'test@example.com',
      password: 'weak', // Too short
      firstName: 'Test',
      lastName: 'User',
      companyName: 'Test Company'
    }

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.message).toBe('Validation failed')
    expect(data.errors.password).toContain('Password must be at least 8 characters long')
  })

  test('should reject registration with existing email', async () => {
    const { getUserByEmail } = require('@/lib/db')
    
    getUserByEmail.mockResolvedValue({
      id: 'existing-user-id',
      email: 'existing@example.com'
    })

    const requestBody = {
      email: 'existing@example.com',
      password: 'securePassword123',
      firstName: 'Test',
      lastName: 'User',
      companyName: 'Test Company'
    }

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.success).toBe(false)
    expect(data.message).toBe('User with this email already exists')
  })

  test('should handle database errors gracefully', async () => {
    const { getUserByEmail } = require('@/lib/db')
    
    getUserByEmail.mockRejectedValue(new Error('Database connection failed'))

    const requestBody = {
      email: 'test@example.com',
      password: 'securePassword123',
      firstName: 'Test',
      lastName: 'User',
      companyName: 'Test Company'
    }

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.message).toBe('Internal server error - please try again later')
  })
})