import Joi from 'joi'
import DOMPurify from 'isomorphic-dompurify'
import { InvocationContext } from '@azure/functions'

// Enhanced validation schemas with strict security rules
export const schemas = {
  fileProcessingMessage: Joi.object({
    fileId: Joi.string().uuid().required(),
    userId: Joi.string().uuid().required(),
    sessionId: Joi.string().uuid().required(),
    blobName: Joi.string().pattern(/^[a-zA-Z0-9\/\-_\.]+$/).max(1024).required(),
    fileName: Joi.string().max(255).required(),
    priority: Joi.number().integer().min(1).max(10).default(5),
    retryCount: Joi.number().integer().min(0).max(10).default(0)
  }),

  aiAnalysisMessage: Joi.object({
    fileId: Joi.string().uuid().required(),
    userId: Joi.string().uuid().required(),
    roleId: Joi.string().uuid().required(),
    sessionId: Joi.string().uuid().required(),
    extractedText: Joi.string().max(100000).required(), // 100KB limit
    priority: Joi.number().integer().min(1).max(10).default(5),
    retryCount: Joi.number().integer().min(0).max(5).default(0)
  }),

  sessionCompletionMessage: Joi.object({
    sessionId: Joi.string().uuid().required(),
    userId: Joi.string().uuid().required(),
    roleId: Joi.string().uuid().required()
  }),

  httpQuery: Joi.object({
    userId: Joi.string().uuid().required(),
    limit: Joi.number().integer().min(1).max(1000).default(100),
    offset: Joi.number().integer().min(0).default(0)
  }),

  sessionId: Joi.string().uuid().required(),
  
  fileId: Joi.string().uuid().required(),
  
  userId: Joi.string().uuid().required(),

  // Enhanced schemas for comprehensive validation
  analysisRequest: Joi.object({
    resumeText: Joi.string().min(100).max(500000).required(), // 100 chars to 500KB
    roleId: Joi.string().uuid().required(),
    sessionId: Joi.string().uuid().required(),
    priority: Joi.number().integer().min(1).max(10).default(5)
  }),

  bulkOperation: Joi.object({
    fileIds: Joi.array().items(Joi.string().uuid()).min(1).max(100).required(),
    operation: Joi.string().valid('analyze', 'delete', 'archive', 'reprocess').required(),
    parameters: Joi.object().optional()
  }),

  uploadRequest: Joi.object({
    fileName: Joi.string().min(1).max(255).pattern(/^[^<>:"|*?\\\/]+\.pdf$/i).required(),
    fileSize: Joi.number().integer().min(1024).max(52428800).required(), // 1KB to 50MB
    contentType: Joi.string().valid('application/pdf').required(),
    sessionId: Joi.string().uuid().optional()
  }),

  queryFilters: Joi.object({
    status: Joi.string().valid('uploaded', 'processing', 'analyzing', 'analyzed', 'failed').optional(),
    dateFrom: Joi.date().iso().optional(),
    dateTo: Joi.date().iso().greater(Joi.ref('dateFrom')).optional(),
    scoreMin: Joi.number().min(0).max(100).optional(),
    scoreMax: Joi.number().min(Joi.ref('scoreMin')).max(100).optional(),
    recommendation: Joi.string().valid('accept', 'maybe', 'reject').optional(),
    limit: Joi.number().integer().min(1).max(1000).default(50),
    offset: Joi.number().integer().min(0).default(0)
  }),

  roleDefinition: Joi.object({
    title: Joi.string().min(2).max(100).pattern(/^[a-zA-Z0-9\s\-_.()]+$/).required(),
    description: Joi.string().max(5000).optional(),
    department: Joi.string().max(100).optional(),
    skills: Joi.array().items(
      Joi.object({
        skillName: Joi.string().min(1).max(100).required(),
        weight: Joi.number().integer().min(1).max(10).required(),
        isRequired: Joi.boolean().default(false),
        category: Joi.string().max(50).optional()
      })
    ).min(1).max(100).required(),
    questions: Joi.array().items(
      Joi.object({
        questionText: Joi.string().min(5).max(1000).required(),
        weight: Joi.number().integer().min(1).max(10).required(),
        category: Joi.string().max(50).optional(),
        expectedAnswerType: Joi.string().valid('text', 'numeric', 'boolean', 'choice').optional()
      })
    ).max(50).optional()
  })
}

// SQL injection prevention patterns
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT|DECLARE)\b)/i,
  /(--|\/\*|\*\/|;|'|"|`)/,
  /(\bOR\b.*=.*\bOR\b)/i,
  /(\bAND\b.*=.*\bAND\b)/i,
  /(xp_|sp_)/i
]

// XSS prevention patterns
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi
]

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS = [
  /\.\./,
  /\.\\\./,
  /%2e%2e/i,
  /%252e%252e/i,
  /\0/
]

/**
 * Enhanced validation with security checks
 */
export function validateInput<T>(
  data: any,
  schema: Joi.ObjectSchema,
  context?: InvocationContext
): T {
  // Pre-validation security checks
  if (data && typeof data === 'object') {
    performSecurityChecks(data, context)
  }

  const { error, value } = schema.validate(data, {
    stripUnknown: true,
    abortEarly: false,
    convert: true,
    presence: 'required'
  })

  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join(', ')
    context?.warn('Validation failed', {
      errors: error.details,
      receivedData: JSON.stringify(data).substring(0, 500)
    })
    throw new ValidationError(`Validation failed: ${errorMessage}`)
  }

  // Post-validation sanitization
  const sanitizedValue = deepSanitize(value)
  
  return sanitizedValue as T
}

/**
 * Perform comprehensive security checks on input data
 */
function performSecurityChecks(data: any, context?: InvocationContext): void {
  const dataString = JSON.stringify(data)
  
  // Check for SQL injection patterns
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(dataString)) {
      context?.error('SQL injection attempt detected', {
        pattern: pattern.source,
        data: dataString.substring(0, 200)
      })
      throw new SecurityError('Malicious input detected')
    }
  }

  // Check for XSS patterns
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(dataString)) {
      context?.error('XSS attempt detected', {
        pattern: pattern.source,
        data: dataString.substring(0, 200)
      })
      throw new SecurityError('Malicious script detected')
    }
  }

  // Check for path traversal
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(dataString)) {
      context?.error('Path traversal attempt detected', {
        pattern: pattern.source,
        data: dataString.substring(0, 200)
      })
      throw new SecurityError('Path traversal detected')
    }
  }

  // Check for excessively long strings (potential DoS)
  if (dataString.length > 1000000) { // 1MB limit
    context?.error('Excessive data size detected', {
      size: dataString.length
    })
    throw new SecurityError('Request too large')
  }
}


/**
 * Validate file name for safe storage
 */
export function validateFileName(fileName: string): string {
  if (!fileName || fileName.length > 255) {
    throw new ValidationError('Invalid file name length')
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, // Windows reserved names
    /^\./,                                      // Hidden files
    /\.\./,                                     // Path traversal
    /%/,                                        // URL encoding
    /[<>:"|*?]/,                               // Invalid characters
    /[\x00-\x1f]/,                             // Control characters
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(fileName)) {
      throw new ValidationError('File name contains invalid characters')
    }
  }

  // Must be PDF
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    throw new ValidationError('Only PDF files are allowed')
  }

  return fileName
}

/**
 * Validate blob name for Azure Storage
 */
export function validateBlobName(blobName: string): string {
  if (!blobName || blobName.length > 1024) {
    throw new ValidationError('Invalid blob name length')
  }

  // Azure blob name restrictions
  if (!/^[a-zA-Z0-9\/\-_\.]+$/.test(blobName)) {
    throw new ValidationError('Blob name contains invalid characters')
  }

  // Prevent path traversal
  if (blobName.includes('..') || blobName.includes('//')) {
    throw new ValidationError('Invalid blob path')
  }

  return blobName
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string, fieldName: string = 'ID'): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  
  if (!uuidRegex.test(uuid)) {
    throw new ValidationError(`Invalid ${fieldName} format`)
  }

  return uuid.toLowerCase()
}

/**
 * Rate limiting validation
 */
export class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>()
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  checkRateLimit(identifier: string): boolean {
    const now = Date.now()
    const userRequests = this.requests.get(identifier)

    if (!userRequests || now > userRequests.resetTime) {
      // Reset window
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs
      })
      return true
    }

    if (userRequests.count >= this.maxRequests) {
      return false // Rate limit exceeded
    }

    userRequests.count++
    return true
  }

  getRemainingRequests(identifier: string): number {
    const userRequests = this.requests.get(identifier)
    if (!userRequests || Date.now() > userRequests.resetTime) {
      return this.maxRequests
    }
    return Math.max(0, this.maxRequests - userRequests.count)
  }
}

/**
 * Deep sanitization of nested objects
 */
function deepSanitize(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj)
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitize(item))
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key, 100)
      sanitized[sanitizedKey] = deepSanitize(value)
    }
    return sanitized
  }
  
  return obj
}

/**
 * Enhanced string sanitization
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    throw new ValidationError('Input must be a string')
  }

  let sanitized = input.trim()
  
  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  
  // HTML encode dangerous characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
  
  // Remove potential SQL injection characters
  sanitized = sanitized.replace(/[';-]/g, '').replace(/--/g, '')
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ')
  
  // Truncate to max length
  return sanitized.substring(0, maxLength)
}

/**
 * Sanitize HTML content using DOMPurify
 */
export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  })
}

/**
 * Custom validation error
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Security error for malicious input detection
 */
export class SecurityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecurityError'
  }
}

/**
 * Security headers for HTTP responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
}