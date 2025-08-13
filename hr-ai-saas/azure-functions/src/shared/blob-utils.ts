import { BlobServiceClient } from '@azure/storage-blob'

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || ''

export async function uploadBlob(
  containerName: string,
  blobName: string,
  data: Buffer
): Promise<string> {
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
  const containerClient = blobServiceClient.getContainerClient(containerName)
  
  // Ensure container exists
  await containerClient.createIfNotExists()
  
  const blockBlobClient = containerClient.getBlockBlobClient(blobName)
  await blockBlobClient.upload(data, data.length)
  
  return blockBlobClient.url
}

export async function downloadBlobAsBuffer(
  containerName: string,
  blobName: string
): Promise<Buffer> {
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
  const containerClient = blobServiceClient.getContainerClient(containerName)
  const blockBlobClient = containerClient.getBlockBlobClient(blobName)
  
  const downloadResponse = await blockBlobClient.download(0)
  const buffer = await streamToBuffer(downloadResponse.readableStreamBody!)
  
  return buffer
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}