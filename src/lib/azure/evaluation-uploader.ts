import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'
import { v4 as uuidv4 } from 'uuid'

export class EvaluationFileUploader {
  private containerClient: ContainerClient

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
    if (!connectionString) {
      throw new Error('Azure Storage connection string not configured')
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    this.containerClient = blobServiceClient.getContainerClient('evaluation-files')
  }

  /**
   * Ensures the container exists
   */
  async ensureContainer(): Promise<void> {
    await this.containerClient.createIfNotExists({
      access: 'blob'
    })
  }

  /**
   * Upload a file to Azure Blob Storage
   */
  async uploadFile(
    file: Buffer,
    originalFilename: string,
    mimeType: string,
    userId: string,
    evaluationId: string
  ): Promise<{
    blobUrl: string
    blobFilename: string
  }> {
    await this.ensureContainer()

    // Generate unique blob name
    const fileExtension = originalFilename.split('.').pop() || 'pdf'
    const blobFilename = `${userId}/${evaluationId}/${uuidv4()}.${fileExtension}`

    // Upload to blob
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobFilename)
    
    await blockBlobClient.uploadData(file, {
      blobHTTPHeaders: {
        blobContentType: mimeType
      },
      metadata: {
        userId,
        evaluationId,
        originalFilename,
        uploadedAt: new Date().toISOString()
      }
    })

    return {
      blobUrl: blockBlobClient.url,
      blobFilename
    }
  }

  /**
   * Download a file from Azure Blob Storage
   */
  async downloadFile(blobFilename: string): Promise<Buffer> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobFilename)
    const downloadResponse = await blockBlobClient.download()
    
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download file from blob storage')
    }

    const chunks: Buffer[] = []
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk))
    }
    
    return Buffer.concat(chunks)
  }

  /**
   * Delete a file from Azure Blob Storage
   */
  async deleteFile(blobFilename: string): Promise<void> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobFilename)
    await blockBlobClient.deleteIfExists()
  }
}