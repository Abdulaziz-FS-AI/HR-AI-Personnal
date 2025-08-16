const { BlobServiceClient } = require('@azure/storage-blob');
require('dotenv').config({ path: '.env.local' });

console.log('🧪 TESTING AZURE BLOB STORAGE CONNECTION');
console.log('=====================================\n');

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

if (!accountName || !accountKey) {
  console.log('❌ Azure Storage credentials not found in environment');
  process.exit(1);
}

console.log('📋 Configuration:');
console.log(`   Account: ${accountName}`);
console.log(`   Key: ${accountKey.substring(0, 10)}...`);
console.log(`   Connection String: ${connectionString ? 'Set' : 'Not set'}`);

async function testBlobStorage() {
  try {
    console.log('\n🔍 Testing blob service connection...');
    
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    
    // Test connection by listing containers
    console.log('📦 Listing containers...');
    const containers = [];
    for await (const container of blobServiceClient.listContainers()) {
      containers.push(container.name);
    }
    
    console.log(`✅ Found ${containers.length} containers: ${containers.join(', ')}`);
    
    // Check if resumes container exists
    const containerClient = blobServiceClient.getContainerClient('resumes');
    console.log('\n🗂️ Checking resumes container...');
    
    try {
      const exists = await containerClient.exists();
      if (exists) {
        console.log('✅ Resumes container exists');
        
        // List some blobs
        const blobs = [];
        for await (const blob of containerClient.listBlobsFlat()) {
          blobs.push(blob.name);
          if (blobs.length >= 5) break; // Limit to first 5
        }
        console.log(`   Contains ${blobs.length} files: ${blobs.slice(0, 3).join(', ')}${blobs.length > 3 ? '...' : ''}`);
      } else {
        console.log('⚠️ Resumes container does not exist - will be created automatically');
      }
    } catch (containerError) {
      console.log('❌ Container check failed:', containerError.message);
    }
    
    console.log('\n✅ Azure Blob Storage: WORKING');
    
  } catch (error) {
    console.log('❌ Azure Blob Storage test failed:', error.message);
    console.log('   Error details:', error.code || 'Unknown');
  }
}

testBlobStorage();