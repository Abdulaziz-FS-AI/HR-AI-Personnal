const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
require('dotenv').config({ path: '.env.local' });

console.log('🧪 TESTING AZURE BLOB STORAGE CONNECTION V2');
console.log('==========================================\n');

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

if (!accountName || !accountKey) {
  console.log('❌ Azure Storage credentials not found in environment');
  process.exit(1);
}

console.log('📋 Configuration:');
console.log(`   Account: ${accountName}`);
console.log(`   Key: ${accountKey.substring(0, 10)}...`);

async function testBlobStorage() {
  try {
    console.log('\n🔍 Testing blob service connection with credentials...');
    
    // Try with explicit credentials instead of connection string
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );
    
    // Test connection by getting service properties
    console.log('📦 Getting service properties...');
    const serviceProperties = await blobServiceClient.getProperties();
    console.log('✅ Service properties retrieved successfully');
    
    // List containers
    console.log('\n📁 Listing containers...');
    const containers = [];
    for await (const container of blobServiceClient.listContainers()) {
      containers.push(container.name);
    }
    
    console.log(`✅ Found ${containers.length} containers: ${containers.join(', ')}`);
    
    // Check if resumes container exists, create if not
    const containerClient = blobServiceClient.getContainerClient('resumes');
    console.log('\n🗂️ Checking/creating resumes container...');
    
    const createResponse = await containerClient.createIfNotExists({
      access: 'blob' // Public read access for blobs
    });
    
    if (createResponse.succeeded) {
      console.log('✅ Resumes container created');
    } else {
      console.log('✅ Resumes container already exists');
    }
    
    // Test uploading a small file
    console.log('\n📤 Testing file upload...');
    const testContent = 'This is a test file for Azure Blob Storage';
    const testBlobName = `test-${Date.now()}.txt`;
    
    const blockBlobClient = containerClient.getBlockBlobClient(testBlobName);
    await blockBlobClient.upload(testContent, testContent.length);
    console.log(`✅ Test file uploaded: ${testBlobName}`);
    
    // Test downloading the file
    console.log('\n📥 Testing file download...');
    const downloadResponse = await blockBlobClient.download();
    const downloaded = await streamToBuffer(downloadResponse.readableStreamBody);
    const downloadedText = downloaded.toString();
    
    if (downloadedText === testContent) {
      console.log('✅ File download successful - content matches');
    } else {
      console.log('❌ File download failed - content mismatch');
    }
    
    // Clean up test file
    await blockBlobClient.delete();
    console.log('🧹 Test file cleaned up');
    
    console.log('\n✅ Azure Blob Storage: FULLY WORKING');
    
  } catch (error) {
    console.log('❌ Azure Blob Storage test failed:', error.message);
    if (error.statusCode) {
      console.log(`   Status Code: ${error.statusCode}`);
    }
    if (error.code) {
      console.log(`   Error Code: ${error.code}`);
    }
  }
}

async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

testBlobStorage();