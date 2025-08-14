import { NextResponse } from 'next/server'

export async function GET() {
  const importResults: any = {}

  try {
    // Test 1: user-context import
    const userContext = await import('@/lib/security/user-context')
    importResults.userContext = 'SUCCESS - ' + Object.keys(userContext).join(', ')
  } catch (err) {
    importResults.userContext = `FAILED: ${err instanceof Error ? err.message : err}`
  }

  try {
    // Test 2: rate-limit import  
    const rateLimit = await import('@/lib/security/rate-limit')
    importResults.rateLimit = 'SUCCESS - ' + Object.keys(rateLimit).join(', ')
  } catch (err) {
    importResults.rateLimit = `FAILED: ${err instanceof Error ? err.message : err}`
  }

  try {
    // Test 3: db-secure import
    const dbSecure = await import('@/lib/db-secure')
    importResults.dbSecure = 'SUCCESS - ' + Object.keys(dbSecure).join(', ')
  } catch (err) {
    importResults.dbSecure = `FAILED: ${err instanceof Error ? err.message : err}`
  }

  return NextResponse.json({
    message: 'Import test results',
    imports: importResults,
    timestamp: new Date().toISOString()
  })
}