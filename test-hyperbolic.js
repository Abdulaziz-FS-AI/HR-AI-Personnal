require('dotenv').config({ path: '.env.local' });

console.log('🧪 TESTING HYPERBOLIC AI CONNECTION');
console.log('===================================\n');

const apiKey = process.env.HYPERBOLIC_API_KEY;
const apiUrl = process.env.HYPERBOLIC_API_URL || 'https://api.hyperbolic.xyz/v1/chat/completions';

if (!apiKey) {
  console.log('❌ HYPERBOLIC_API_KEY not found in environment');
  process.exit(1);
}

console.log('📋 Configuration:');
console.log(`   API Key: ${apiKey.substring(0, 20)}...`);
console.log(`   API URL: ${apiUrl}`);

async function testHyperbolicAI() {
  try {
    console.log('\n🔍 Testing Hyperbolic AI connection...');
    
    const testRequest = {
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant. Respond with exactly "HYPERBOLIC_TEST_SUCCESS" if you receive this message.'
        },
        {
          role: 'user',
          content: 'Test connection'
        }
      ],
      max_tokens: 50,
      temperature: 0
    };
    
    console.log('📤 Sending test request...');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testRequest)
    });
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Request failed:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('📥 Response received');
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const content = data.choices[0].message.content;
      console.log(`💬 AI Response: "${content}"`);
      
      if (content.includes('HYPERBOLIC_TEST_SUCCESS')) {
        console.log('✅ Hyperbolic AI: WORKING');
      } else {
        console.log('⚠️ Hyperbolic AI responding but unexpected response');
      }
      
      // Check usage info
      if (data.usage) {
        console.log(`📊 Token usage: ${data.usage.prompt_tokens} prompt + ${data.usage.completion_tokens} completion = ${data.usage.total_tokens} total`);
      }
    } else {
      console.log('❌ Unexpected response format:', data);
    }
    
  } catch (error) {
    console.log('❌ Hyperbolic AI test failed:', error.message);
    if (error.cause) {
      console.log('   Cause:', error.cause.message);
    }
  }
}

testHyperbolicAI();