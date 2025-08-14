/**
 * Azure Functions Entry Point
 * HR AI SaaS Processing Pipeline
 */

// Import all function modules to register them
import './functions/pdfProcessor'
import './functions/aiAnalyzer'
import './functions/resultsCompiler'

// Export functions for testing and external access
export { pdfProcessor } from './functions/pdfProcessor'
export { aiAnalyzer, sessionCompletionChecker } from './functions/aiAnalyzer'
export { getEvaluationResults, getSessionProgress } from './functions/resultsCompiler'

// Export shared utilities
export * from './shared/db-utils'
export * from './shared/blob-utils'
export * from './shared/ai-utils'
export * from './shared/service-bus-utils'

console.log('HR AI SaaS Azure Functions loaded successfully')