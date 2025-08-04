import { BlobServiceClient } from '@azure/storage-blob'

let blobServiceClient: BlobServiceClient | null = null

/**
 * Get blob service client (singleton)
 */
export function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING environment variable is required')
    }
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
  }
  return blobServiceClient
}

/**
 * Download blob content as Buffer
 */
export async function downloadBlobAsBuffer(
  containerName: string,
  blobName: string
): Promise<Buffer> {
  const blobServiceClient = getBlobServiceClient()
  const containerClient = blobServiceClient.getContainerClient(containerName)
  const blobClient = containerClient.getBlobClient(blobName)

  const downloadResponse = await blobClient.download()
  const stream = downloadResponse.readableStreamBody

  if (!stream) {
    throw new Error(`Failed to download blob: ${blobName}`)
  }

  // Convert stream to buffer
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}

/**
 * Upload buffer to blob
 */
export async function uploadBufferToBlob(
  containerName: string,
  blobName: string,
  buffer: Buffer,
  contentType?: string
): Promise<string> {
  const blobServiceClient = getBlobServiceClient()
  const containerClient = blobServiceClient.getContainerClient(containerName)
  
  // Ensure container exists
  await containerClient.createIfNotExists()
  
  const blobClient = containerClient.getBlobClient(blobName)
  const blockBlobClient = blobClient.getBlockBlobClient()

  await blockBlobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: {
      blobContentType: contentType || 'application/octet-stream'
    }
  })

  return blobClient.url
}

/**
 * Check if blob exists
 */
export async function blobExists(
  containerName: string,
  blobName: string
): Promise<boolean> {
  try {
    const blobServiceClient = getBlobServiceClient()
    const containerClient = blobServiceClient.getContainerClient(containerName)
    const blobClient = containerClient.getBlobClient(blobName)
    
    return await blobClient.exists()
  } catch (error) {
    console.error('Error checking blob existence:', error)
    return false
  }
}

/**
 * Delete blob
 */
export async function deleteBlob(
  containerName: string,
  blobName: string
): Promise<boolean> {
  try {
    const blobServiceClient = getBlobServiceClient()
    const containerClient = blobServiceClient.getContainerClient(containerName)
    const blobClient = containerClient.getBlobClient(blobName)
    
    await blobClient.deleteIfExists()
    return true
  } catch (error) {
    console.error('Error deleting blob:', error)
    return false
  }
}

/**
 * Get blob properties
 */
export async function getBlobProperties(
  containerName: string,
  blobName: string
): Promise<any> {
  try {
    const blobServiceClient = getBlobServiceClient()
    const containerClient = blobServiceClient.getContainerClient(containerName)
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