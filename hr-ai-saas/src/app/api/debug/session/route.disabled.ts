import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { executeQuery } from "@/lib/db-utils"

export async function GET() {
  try {
    // Get current session
    const session = await auth()
    
    // Get user from database if session exists
    let dbUser = null
    if (session?.user?.email) {
      dbUser = await executeQuery(async (pool) => {
        const result = await pool.request()
          .input('email', session.user.email)
          .query(`
            SELECT id, email, company_name, first_name, last_name, 
                   subscription_tier, credits_remaining, created_at
            FROM users 
            WHERE email = @email
          `)
        return result.recordset[0]
      })
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      session: {
        exists: !!session,
        user: session?.user || null,
        expires: session?.expires || null
      },
      database: {
        userFound: !!dbUser,
        userData: dbUser || null
      },
      analysis: {
        sessionUserHasId: !!session?.user?.id,
        sessionUserHasEmail: !!session?.user?.email,
        sessionUserHasName: !!session?.user?.name,
        sessionUserHasCompany: !!session?.user?.company,
        databaseUserExists: !!dbUser,
        mismatch: session && dbUser && session.user?.id !== dbUser?.id
      }
    })
  } catch (error) {
    console.error('Debug session error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}