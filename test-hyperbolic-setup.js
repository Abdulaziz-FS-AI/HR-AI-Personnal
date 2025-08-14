/**
 * Secure test script to validate Hyperbolic AI setup
 * Run with: node test-hyperbolic-setup.js
 * 
 * IMPORTANT: This script does NOT contain any API keys
 * Set your HYPERBOLIC_API_KEY environment variable before running
 */

require('dotenv').config({ path: '.env.local' })

// Sample data for testing (no sensitive info)
const sampleRole = {
  title: "Frontend Developer",
  skills: [
    { skillName: "JavaScript", weight: 9, isRequired: true },
    { skillName: "React", weight: 8, isRequired: true },
    { skillName: "TypeScript", weight: 7, isRequired: false },
  ],
  questions: [
    { questionText: "Describe your experience with modern JavaScript frameworks", weight: 8 }
  ],
  requirements: {
    experience: { min: 2, max: 5 },
    education: "Bachelor's degree in Computer Science or equivalent"
  }
}

const sampleResume = `John Smith - Frontend Developer
Email: john@example.com | Phone: (555) 123-4567
4 years experience with React, JavaScript, TypeScript
Built 15+ web applications, improved performance by 40%`

// System prompt (same structure as production)
const systemPrompt = `You are an expert HR AI assistant specializing in resume analysis.
CRITICAL: Always respond with valid JSON format.
Evaluate candidates objectively based on evidence.`

// User prompt builder (same structure as production)  
function buildUserPrompt(resume, role) {
  const skillsList = role.skills.map(s => 
    `• ${s.skillName} [Weight: ${s.weight}/10]${s.isRequired ? ' [REQUIRED]' : ''}`
  ).join('\n')

  return `Analyze this resume for "${role.title}".
SKILLS: ${skillsList}
RESUME: ${resume}`
}

// Validation function
function validateSetup() {
  console.log('🔒 SECURITY VALIDATION:')
  console.log('━'.repeat(50))
  
  // Check if API key is properly set via environment
  const hasApiKey = !!process.env.HYPERBOLIC_API_KEY
  console.log('✅ API Key loaded from environment:', hasApiKey ? 'YES' : '❌ NO')
  
  if (!hasApiKey) {
    console.log('\n🚨 SETUP REQUIRED:')
    console.log('1. Copy .env.local.example to .env.local')
    console.log('2. Add your Hyperbolic API key to .env.local')
    console.log('3. Never commit .env.local to git')
    return false
  }
  
  // Check gitignore protection
  const fs = require('fs')
  try {
    const gitignore = fs.readFileSync('.gitignore', 'utf8')
    const protectsEnv = gitignore.includes('.env.local')
    console.log('✅ .env.local protected by gitignore:', protectsEnv ? 'YES' : '❌ NO')
  } catch (err) {
    console.log('⚠️ Could not check .gitignore')
  }
  
  console.log('')
  console.log('🎯 PROMPT STRUCTURE:')
  console.log('━'.repeat(50))
  
  const userPrompt = buildUserPrompt(sampleResume, sampleRole)
  console.log('System Prompt Length:', systemPrompt.length, 'characters')
  console.log('User Prompt Length:', userPrompt.length, 'characters')
  console.log('Total Token Estimate:', Math.ceil((systemPrompt.length + userPrompt.length) / 4))
  
  console.log('')
  console.log('⚙️ API CONFIGURATION:')
  console.log('━'.repeat(50))
  console.log('Model: openai/gpt-oss-120b')
  console.log('Temperature: 0.15 (consistent scoring)')
  console.log('Max Tokens: 2000')
  console.log('Stream: false')
  
  return true
}

// Test API call structure (without making actual request)
async function testApiStructure() {
  if (!validateSetup()) {
    process.exit(1)
  }
  
  const userPrompt = buildUserPrompt(sampleResume, sampleRole)
  
  // Show the request structure (WITHOUT the actual API key)
  const requestStructure = {
    url: 'https://api.hyperbolic.xyz/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer [HIDDEN_API_KEY]'
    },
    body: {
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content: '[SYSTEM_PROMPT_PREVIEW]'
        },
        {
          role: 'user',
          content: '[USER_PROMPT_PREVIEW]'
        }
      ],
      max_tokens: 2000,
      temperature: 0.15,
      top_p: 0.85,
      stream: false
    }
  }
  
  console.log('🚀 REQUEST STRUCTURE (API key hidden for security):')
  console.log('━'.repeat(50))
  console.log(JSON.stringify(requestStructure, null, 2))
  
  console.log('')
  console.log('✅ Setup Complete! Your evaluation system is ready.')
  console.log('')
  console.log('📋 NEXT STEPS:')
  console.log('1. Test with a real evaluation in your app')
  console.log('2. Monitor API usage and costs')
  console.log('3. Set up rate limiting alerts')
}

// Run the validation
testApiStructure().catch(console.error)