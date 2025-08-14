#!/usr/bin/env node

/**
 * Test script to verify Service Bus connection
 */

const { ServiceBusClient } = require('@azure/service-bus');
require('dotenv').config({ path: '.env.local' });

async function testServiceBus() {
  console.log('🧪 Testing Azure Service Bus Connection...\n');

  const connectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
  
  if (!connectionString) {
    console.error('❌ AZURE_SERVICE_BUS_CONNECTION_STRING not found in .env.local');
    process.exit(1);
  }

  try {
    // Create Service Bus client
    const client = new ServiceBusClient(connectionString);
    const sender = client.createSender('evaluation-queue');

    // Test message
    const testMessage = {
      body: {
        evaluationId: 'test-' + Date.now(),
        roleId: 'test-role',
        userId: 'test-user',
        userEmail: 'test@example.com',
        roleTitle: 'Test Role',
        files: [
          {
            id: 'file-1',
            filename: 'test.pdf',
            content: 'base64-content-here'
          }
        ],
        timestamp: new Date().toISOString()
      },
      contentType: 'application/json',
      subject: 'test-message'
    };

    console.log('📤 Sending test message to queue...');
    await sender.sendMessages(testMessage);
    console.log('✅ Message sent successfully!');

    // Close connections
    await sender.close();
    await client.close();

    console.log('\n🎉 Service Bus connection test passed!');
    console.log('Queue: evaluation-queue');
    console.log('Namespace:', process.env.AZURE_SERVICE_BUS_NAMESPACE);
    
  } catch (error) {
    console.error('❌ Service Bus test failed:', error.message);
    process.exit(1);
  }
}

// Run test
testServiceBus().catch(console.error);