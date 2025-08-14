#!/usr/bin/env node

/**
 * Migration script to upgrade existing routes to new security layer
 * Run this to automatically update all API routes with the new security implementation
 */

import fs from 'fs'
import path from 'path'

const API_DIR = path.join(__dirname, '../../app/api')

// Map of old imports to new imports
const IMPORT_REPLACEMENTS = [
  {
    old: 'import { auth } from "@/lib/auth"',
    new: 'import { requireUserContext, logDataAccess, validateResourceOwnership } from "@/lib/security/user-context"'
  },
  {
    old: /import \{[^}]*getRolesByUserId[^}]*\} from "@\/lib\/db"/g,
    new: 'import { getUserRoles } from "@/lib/db-secure"'
  },
  {
    old: /import \{[^}]*createRole[^}]*\} from "@\/lib\/db"/g,
    new: 'import { createUserRole } from "@/lib/db-secure"'
  },
  {
    old: /import \{[^}]*getRoleById[^}]*\} from "@\/lib\/db"/g,
    new: 'import { getUserRole } from "@/lib/db-secure"'
  },
  {
    old: /import \{[^}]*updateRole[^}]*\} from "@\/lib\/db"/g,
    new: 'import { updateUserRole } from "@/lib/db-secure"'
  },
  {
    old: /import \{[^}]*deleteRole[^}]*\} from "@\/lib\/db"/g,
    new: 'import { deleteUserRole } from "@/lib/db-secure"'
  }
]

// Function replacements
const FUNCTION_REPLACEMENTS = [
  {
    old: /const session = await auth\(\)[\s\S]*?if \(!session\?\.user\?\.id\) \{[\s\S]*?\}/g,
    new: 'const userContext = await requireUserContext(request)'
  },
  {
    old: /session\.user\.id/g,
    new: 'userContext.userId'
  },
  {
    old: /getRolesByUserId\(/g,
    new: 'getUserRoles('
  },
  {
    old: /createRole\(/g,
    new: 'createUserRole(userContext.userId, '
  },
  {
    old: /getRoleById\((.*?), (.*?)\)/g,
    new: 'getUserRole($2, $1)'
  },
  {
    old: /updateRole\((.*?), (.*?), (.*?)\)/g,
    new: 'updateUserRole($2, $1, $3)'
  },
  {
    old: /deleteRole\((.*?), (.*?)\)/g,
    new: 'deleteUserRole($2, $1)'
  }
]

async function migrateFile(filePath: string): Promise<boolean> {
  try {
    let content = fs.readFileSync(filePath, 'utf-8')
    let modified = false
    
    // Skip if already migrated
    if (content.includes('requireUserContext')) {
      console.log(`✓ Already migrated: ${path.basename(filePath)}`)
      return false
    }
    
    // Apply import replacements
    for (const replacement of IMPORT_REPLACEMENTS) {
      if (typeof replacement.old === 'string') {
        if (content.includes(replacement.old)) {
          content = content.replace(replacement.old, replacement.new)
          modified = true
        }
      } else {
        const matches = content.match(replacement.old)
        if (matches) {
          content = content.replace(replacement.old, replacement.new)
          modified = true
        }
      }
    }
    
    // Apply function replacements
    for (const replacement of FUNCTION_REPLACEMENTS) {
      const matches = content.match(replacement.old)
      if (matches) {
        content = content.replace(replacement.old, replacement.new)
        modified = true
      }
    }
    
    // Add rate limiting import if not present
    if (modified && !content.includes('withRateLimit')) {
      const importIndex = content.lastIndexOf('import')
      const nextLineIndex = content.indexOf('\n', importIndex)
      content = content.slice(0, nextLineIndex + 1) + 
                'import { withRateLimit } from "@/lib/security/rate-limit"\n' +
                content.slice(nextLineIndex + 1)
    }
    
    if (modified) {
      // Create backup
      const backupPath = filePath + '.backup'
      fs.writeFileSync(backupPath, fs.readFileSync(filePath))
      
      // Write updated content
      fs.writeFileSync(filePath, content)
      console.log(`✅ Migrated: ${path.basename(filePath)} (backup created)`)
      return true
    }
    
    return false
  } catch (error) {
    console.error(`❌ Failed to migrate ${filePath}:`, error)
    return false
  }
}

async function findApiRoutes(dir: string): Promise<string[]> {
  const routes: string[] = []
  
  function scanDir(currentDir: string) {
    const files = fs.readdirSync(currentDir)
    
    for (const file of files) {
      const fullPath = path.join(currentDir, file)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory()) {
        scanDir(fullPath)
      } else if (file === 'route.ts' || file === 'route.js') {
        routes.push(fullPath)
      }
    }
  }
  
  scanDir(dir)
  return routes
}

async function main() {
  console.log('🔒 Starting security migration...\n')
  
  // Find all API routes
  const routes = await findApiRoutes(API_DIR)
  console.log(`Found ${routes.length} API routes\n`)
  
  let migrated = 0
  let skipped = 0
  let failed = 0
  
  // Migrate each route
  for (const route of routes) {
    const result = await migrateFile(route)
    if (result) {
      migrated++
    } else if (result === false) {
      skipped++
    } else {
      failed++
    }
  }
  
  console.log('\n📊 Migration Summary:')
  console.log(`✅ Migrated: ${migrated} files`)
  console.log(`⏭️  Skipped: ${skipped} files (already migrated)`)
  if (failed > 0) {
    console.log(`❌ Failed: ${failed} files`)
  }
  
  console.log('\n🎯 Next Steps:')
  console.log('1. Run: npm run build')
  console.log('2. Test all API endpoints')
  console.log('3. Deploy security schema: curl -X POST http://localhost:3000/api/deploy-security-schema')
  console.log('4. Remove backup files after verification')
}

main().catch(console.error)