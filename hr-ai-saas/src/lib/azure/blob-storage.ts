import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } from '@azure/storage-blob'

interface BlobConfig {
  accountName: string
  accountKey: string
  containerName: string
}

interface UploadUrlRequest {
  fileName: string
  userId: string
  fileSize: number
  contentType: string
}

interface UploadUrlResponse {
  uploadUrl: string
  blobName: string
  expiresAt: Date
}

class BlobStorageService {
  private blobServiceClient: BlobServiceClient
  private config: BlobConfig
  private credential: StorageSharedKeyCredential

  constructor() {
    // Validate environment variables
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY
    
    if (!accountName || !accountKey) {
      throw new Error('Azure Storage credentials not configured. Please set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY environment variables.')
    }
    
    // Validate account name format
    if (!/^[a-z0-9]{3,24}$/.test(accountName)) {
      throw new Error('Invalid Azure Storage account name format')
    }
    
    // Validate account key format (base64)
    if (accountKey.length < 44 || !/^[A-Za-z0-9+/]+=*$/.test(accountKey)) {
      throw new Error('Invalid Azure Storage account key format')
    }

    this.config = {
      accountName,
      accountKey,
      containerName: 'resumes'
    }

    this.credential = new StorageSharedKeyCredential(
      this.config.accountName,
      this.config.accountKey
    )

    this.blobServiceClient = new BlobServiceClient(
      `https://${this.config.accountName}.blob.core.windows.net`,
      this.credential
    )
  }

  /**
   * Generate a secure upload URL with SAS token for direct client upload
   */
  async generateUploadUrl(request: UploadUrlRequest): Promise<UploadUrlResponse> {
    try {
      const blobName = this.generateBlobName(request.fileName, request.userId)
      const containerClient = this.blobServiceClient.getContainerClient(this.config.containerName)
      
      // Ensure container exists
      await containerClient.createIfNotExists({
        access: 'private'
      })

      const blobClient = containerClient.getBlobClient(blobName)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

      // Generate SAS token with write permissions only
      const sasToken = generateBlobSASQueryParameters({
        containerName: this.config.containerName,
        blobName: blobName,
        permissions: BlobSASPermissions.parse('w'), // Write only
        startsOn: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago to account for clock skew
        expiresOn: expiresAt,
      }, this.credential)

      const uploadUrl = `${blobClient.url}?${sasToken}`

      return {
        uploadUrl,
        blobName,
        expiresAt
      }
    } catch (error) {
      console.error('Error generating upload URL:', error)
      throw new Error(`Failed to generate upload URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get a secure download URL for a blob
   */
  async generateDownloadUrl(blobName: string, expirationHours: number = 1): Promise<string> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.config.containerName)
      const blobClient = containerClient.getBlobClient(blobName)

      const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000)

      const sasToken = generateBlobSASQueryParameters({
        containerName: this.config.containerName,
        blobName: blobName,
        permissions: BlobSASPermissions.parse('r'), // Read only
        startsOn: new Date(Date.now() - 5 * 60 * 1000),
        expiresOn: expiresAt,
      }, this.credential)

      return `${blobClient.url}?${sasToken}`
    } catch (error) {
      console.error('Error generating download URL:', error)
      throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if a blob exists
   */
  async blobExists(blobName: string): Promise<boolean> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.config.containerName)
      const blobClient = containerClient.getBlobClient(blobName)
      
      const response = await blobClient.exists()
      return response
    } catch (error) {
      console.error('Error checking blob existence:', error)
      return false
    }
  }

  /**
   * Delete a blob
   */
  async deleteBlob(blobName: string): Promise<boolean> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.config.containerName)
      const blobClient = containerClient.getBlobClient(blobName)
      
      await blobClient.deleteIfExists()
      return true
    } catch (error) {
      console.error('Error deleting blob:', error)
      return false
    }
  }

  /**
   * Get blob metadata and properties
   */
  async getBlobProperties(blobName: string) {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.config.containerName)
      const blobClient = containerClient.getBlobClient(blobName)
      
      const properties = await blobClient.getProperties()
      return {
        contentLength: properties.contentLength,
        contentType: properties.contentType,
        lastModified: properties.lastModified,
        etag: properties.etag,
        exists: true
      }
    } catch (error) {
      console.error('Error getting blob properties:', error)
      return { exists: false }
    }
  }

  /**
   * Generate a unique blob name with enhanced user isolation and organization
   */
  private generateBlobName(originalFileName: string, userId: string): string {
    const timestamp = Date.now()
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    
    const sanitizedFileName = originalFileName
      .replace(/[^a-zA-Z0-9\-_\.]/g, '-')
      .replace(/\s+/g, '-')
      .toLowerCase()
    
    // Enhanced structure: users/{userId}/{year}/{month}/{timestamp}-{filename}
    // This provides better organization and prevents directory listing attacks
    return `users/${userId}/${year}/${month}/${timestamp}-${sanitizedFileName}`
  }

  /**
   * Validate file for upload with enhanced security checks
   */
  validateFile(fileName: string, fileSize: number, contentType: string): { valid: boolean; error?: string } {
    // File size validation (10MB max)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (fileSize > maxSize) {
      return { valid: false, error: 'File size exceeds 10MB limit' }
    }

    // Minimum file size (1KB to prevent empty/malicious files)
    const minSize = 1024 // 1KB
    if (fileSize < minSize) {
      return { valid: false, error: 'File too small - minimum 1KB required' }
    }

    // File type validation (PDF only)
    const allowedTypes = ['application/pdf']
    if (!allowedTypes.includes(contentType)) {
      return { valid: false, error: 'Only PDF files are allowed' }
    }

    // Enhanced file name validation
    if (!fileName || fileName.length > 255) {
      return { valid: false, error: 'File name too long (max 255 characters)' }
    }

    // Check for dangerous file names
    const dangerousPatterns = [
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, // Windows reserved names
      /^\./,                                      // Hidden files
      /\.\./,                                     // Path traversal
      /%/,                                        // URL encoding
      /[<>:"|*?]/,                               // Invalid characters
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(fileName)) {
        return { valid: false, error: 'File name contains invalid characters or patterns' }
      }
    }

    // File extension validation (must be .pdf)
    const fileNameRegex = /^[a-zA-Z0-9\s\-_()\.]+\.pdf$/i
    if (!fileNameRegex.test(fileName)) {
      return { valid: false, error: 'Invalid file name or extension - only PDF files with safe characters allowed' }
    }

    return { valid: true }
  }

  /**
   * Get blob URL without SAS (for internal use)
   */
  getBlobUrl(blobName: string): string {
    const containerClient = this.blobServiceClient.getContainerClient(this.config.containerName)
    const blobClient = containerClient.getBlobClient(blobName)
    return blobClient.url
  }
}

// Singleton instance
let blobStorageService: BlobStorageService | null = null

export function getBlobStorageService(): BlobStorageService {
  if (!blobStorageService) {
    blobStorageService = new BlobStorageService()
  }
  return blobStorageService
}

export type { UploadUrlRequest, UploadUrlResponse }