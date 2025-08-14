import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import MicrosoftEntraIDProvider from "next-auth/providers/microsoft-entra-id"
import { compare } from "bcryptjs"
import { getUserByEmail, createUserFromOAuth } from "./db"

/**
 * Validates that all required authentication environment variables are present
 * @throws {Error} If any required environment variable is missing or invalid
 */
function validateAuthConfig() {
  // NEXTAUTH_SECRET validation
  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET environment variable is required')
  }
  
  if (process.env.NEXTAUTH_SECRET.length < 32) {
    throw new Error('NEXTAUTH_SECRET must be at least 32 characters long for security')
  }
  
  // OAuth provider validation (warn if missing)
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('Warning: Google OAuth credentials not configured - Google sign-in will be disabled')
  }
  
  if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    console.warn('Warning: Microsoft OAuth credentials not configured - Microsoft sign-in will be disabled')
  }
}

// Validate configuration on module load
validateAuthConfig()

const authConfig = {
  debug: process.env.NODE_ENV === 'development',
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    MicrosoftEntraIDProvider({
      clientId: process.env.MICROSOFT_CLIENT_ID || "",
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "",
      tenantId: process.env.MICROSOFT_TENANT_ID || "common",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await getUserByEmail(credentials.email as string)
        
        if (!user) {
          return null
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          company: user.companyName,
        }
      }
    })
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
    signUp: "/register",
    error: "/login",
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' 
        ? `__Secure-authjs.session-token` 
        : `authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 // 30 days
      }
    }
  },
  callbacks: {
    async signIn({ user, account }: { user: any; account: any }) {
      if (account?.provider === "google" || account?.provider === "microsoft-entra-id") {
        try {
          // Check if user already exists
          let existingUser = await getUserByEmail(user.email)
          
          if (!existingUser) {
            // Create new user from OAuth
            existingUser = await createUserFromOAuth({
              email: user.email,
              firstName: user.name?.split(' ')[0] || '',
              lastName: user.name?.split(' ').slice(1).join(' ') || '',
              googleId: account.provider === "google" ? user.id : undefined,
              microsoftId: account.provider === "microsoft-entra-id" ? user.id : undefined,
              avatar: user.image
            })
          }
          
          if (!existingUser) {
            console.error('Failed to create or retrieve user from database')
            return false
          }
          
          // Update user object with database ID
          user.id = existingUser.id
          user.company = existingUser.companyName
          return true
        } catch (error) {
          console.error(`Error creating user from ${account.provider} OAuth:`, error)
          // Check if it's a table missing error
          if (error instanceof Error && error.message.includes('Invalid object name \'users\'')) {
            console.error('Database tables not deployed - please run /api/deploy-schema')
          }
          return false
        }
      }
      return true
    },
    async jwt({ token, user, account }: { token: Record<string, unknown>; user: Record<string, unknown> | undefined; account: any }) {
      if (user) {
        token.id = user.id
        token.company = user.company
      }
      return token
    },
    async session({ session, token }: { session: any; token: Record<string, unknown> }) {
      if (token) {
        session.user.id = token.id as string
        session.user.company = token.company as string
      }
      return session
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)