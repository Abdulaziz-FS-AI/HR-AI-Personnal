#!/usr/bin/env node

/**
 * Comprehensive Test Runner for HR AI SaaS
 * Runs all test suites and generates a detailed report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 HR AI SaaS - Comprehensive Test Suite Runner\n');

const testResults = {
  timestamp: new Date().toISOString(),
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  testSuites: [],
  coverage: null,
  duration: 0
};

const startTime = Date.now();

// Test categories to run
const testCategories = [
  {
    name: 'Health Check Tests',
    command: 'npx jest __tests__/health-check.test.ts --verbose',
    critical: true
  },
  {
    name: 'Component Tests',
    command: 'npm run test:components',
    critical: true
  },
  {
    name: 'Integration Tests',
    command: 'npm run test:integration',
    critical: false
  },
  {
    name: 'Database Tests',
    command: 'npm run test:db',
    critical: false
  },
  {
    name: 'API Tests',
    command: 'npm run test:api',
    critical: false
  }
];

// Change to the correct directory
const projectDir = __dirname; // We're already in the hr-ai-saas directory
console.log(`📁 Project Directory: ${projectDir}\n`);

try {
  process.chdir(projectDir);
} catch (error) {
  console.error('❌ Failed to change to project directory:', error.message);
  process.exit(1);
}

// Run each test category
for (const category of testCategories) {
  console.log(`🔍 Running: ${category.name}`);
  console.log(`   Command: ${category.command}`);
  
  try {
    const output = execSync(category.command, { 
      encoding: 'utf8',
      timeout: 60000 // 60 second timeout
    });
    
    console.log('✅ PASSED\n');
    
    // Parse test results (basic parsing)
    const lines = output.split('\n');
    const testLine = lines.find(line => line.includes('Tests:'));
    
    testResults.testSuites.push({
      name: category.name,
      status: 'PASSED',
      critical: category.critical,
      output: testLine || 'Tests completed successfully'
    });
    
  } catch (error) {
    console.log(`❌ FAILED: ${category.name}`);
    console.log(`   Error: ${error.message}\n`);
    
    testResults.testSuites.push({
      name: category.name,
      status: 'FAILED',
      critical: category.critical,
      error: error.message
    });
    
    // If it's a critical test and it fails, we might want to stop
    if (category.critical) {
      console.log('⚠️  Critical test failed, but continuing with other tests...\n');
    }
  }
}

// Calculate totals
testResults.duration = Date.now() - startTime;
testResults.passedTests = testResults.testSuites.filter(s => s.status === 'PASSED').length;
testResults.failedTests = testResults.testSuites.filter(s => s.status === 'FAILED').length;
testResults.totalTests = testResults.testSuites.length;

// Generate final report
console.log('\n📊 TEST EXECUTION SUMMARY');
console.log('========================');
console.log(`⏱️  Duration: ${testResults.duration}ms`);
console.log(`📊 Total Test Suites: ${testResults.totalTests}`);
console.log(`✅ Passed: ${testResults.passedTests}`);
console.log(`❌ Failed: ${testResults.failedTests}`);
console.log(`📈 Success Rate: ${((testResults.passedTests / testResults.totalTests) * 100).toFixed(1)}%`);

console.log('\n📋 DETAILED RESULTS:');
testResults.testSuites.forEach((suite, index) => {
  const status = suite.status === 'PASSED' ? '✅' : '❌';
  const critical = suite.critical ? '🔴 CRITICAL' : '🟡 STANDARD';
  console.log(`${index + 1}. ${status} ${suite.name} (${critical})`);
  if (suite.output) {
    console.log(`   ${suite.output}`);
  }
  if (suite.error) {
    console.log(`   Error: ${suite.error}`);
  }
});

// Save results to file
const reportPath = path.join(__dirname, 'test-results.json');
fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
console.log(`\n💾 Full report saved to: ${reportPath}`);

// Final status
const criticalFailures = testResults.testSuites.filter(s => s.critical && s.status === 'FAILED').length;

if (criticalFailures > 0) {
  console.log('\n🚨 CRITICAL TESTS FAILED - Application may not be ready for production');
  process.exit(1);
} else if (testResults.failedTests > 0) {
  console.log('\n⚠️  Some tests failed, but critical functionality is working');
  process.exit(0);
} else {
  console.log('\n🎉 ALL TESTS PASSED - Application is healthy!');
  process.exit(0);
}