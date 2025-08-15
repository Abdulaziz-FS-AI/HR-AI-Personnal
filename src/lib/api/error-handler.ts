import { NextResponse } from 'next/server'

export interface ApiError {
  code: string
  message: string
  details?: string
  field?: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: ApiError
  errors?: ApiError[]
  message?: string
  timestamp: string
  responseTime?: number
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  responseTime?: number
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    responseTime
  })
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: ApiError | string,
  status: number = 500,
  responseTime?: number
): NextResponse<ApiResponse> {
  const apiError: ApiError = typeof error === 'string' 
    ? { code: 'INTERNAL_ERROR', message: error }
    : error

  return NextResponse.json({
    success: false,
    error: apiError,
    timestamp: new Date().toISOString(),
    responseTime
  }, { status })
}

/**
 * Create a validation error response with multiple field errors
 */
export function createValidationErrorResponse(
  errors: ApiError[],
  responseTime?: number
): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    errors,
    message: 'Validation failed',
    timestamp: new Date().toISOString(),
    responseTime
  }, { status: 400 })
}

/**
 * Wrap an API handler with consistent error handling
 */
export function withErrorHandler(
  handler: (request: any, ...args: any[]) => Promise<NextResponse>
) {
  return async (request: any, ...args: any[]): Promise<NextResponse> => {
    const startTime = Date.now()
    
    try {
      return await handler(request, ...args)
    } catch (error) {
      console.error('API Error:', error)
      
      const responseTime = Date.now() - startTime
      
      // Handle specific error types
      if (error instanceof ValidationError) {
        return createValidationErrorResponse(error.errors, responseTime)
      }
      
      if (error instanceof AuthenticationError) {
        return createErrorResponse({
          code: 'AUTHENTICATION_REQUIRED',
          message: error.message || 'Authentication required'
        }, 401, responseTime)
      }
      
      if (error instanceof AuthorizationError) {
        return createErrorResponse({
          code: 'INSUFFICIENT_PERMISSIONS',
          message: error.message || 'Insufficient permissions'
        }, 403, responseTime)
      }
      
      if (error instanceof NotFoundError) {
        return createErrorResponse({
          code: 'RESOURCE_NOT_FOUND',
          message: error.message || 'Resource not found'
        }, 404, responseTime)
      }
      
      if (error instanceof RateLimitError) {
        return createErrorResponse({
          code: 'RATE_LIMIT_EXCEEDED',
          message: error.message || 'Rate limit exceeded'
        }, 429, responseTime)
      }
      
      // Default error response
      return createErrorResponse({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : String(error))
          : undefined
      }, 500, responseTime)
    }
  }
}

/**
 * Custom error classes for better error handling
 */
export class ValidationError extends Error {
  constructor(public errors: ApiError[]) {
    super('Validation failed')
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Insufficient permissions') {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Resource not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class RateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded') {
    super(message)
    this.name = 'RateLimitError'
  }
}

/**
 * Validate request body with Zod-like validation
 */
export function validateRequestBody<T>(
  body: any,
  requiredFields: string[],
  optionalFields?: string[]
): T {
  const errors: ApiError[] = []
  
  // Check required fields
  for (const field of requiredFields) {
    if (!body[field]) {
      errors.push({
        code: 'FIELD_REQUIRED',
        message: `Field '${field}' is required`,
        field
      })
    }
  }
  
  // Check for unexpected fields
  const allowedFields = [...requiredFields, ...(optionalFields || [])]
  for (const field of Object.keys(body)) {
    if (!allowedFields.includes(field)) {
      errors.push({
        code: 'FIELD_UNEXPECTED',
        message: `Field '${field}' is not allowed`,
        field
      })
    }
  }
  
  if (errors.length > 0) {
    throw new ValidationError(errors)
  }
  
  return body as T
}