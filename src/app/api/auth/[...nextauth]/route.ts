/**
 * NextAuth.js Route Handler for App Router
 * 
 * This file is CRITICAL for authentication to work in production.
 * It exports the HTTP handlers from the centralized auth configuration.
 * 
 * Handles all authentication routes:
 * - /api/auth/signin (sign in page)
 * - /api/auth/signout (sign out)
 * - /api/auth/callback/* (OAuth callbacks for Google, Microsoft)
 * - /api/auth/session (get current session)
 * - /api/auth/providers (list available providers)
 */

import { handlers } from "@/lib/auth"

// Export the handlers for GET and POST requests
export const { GET, POST } = handlers

// This enables:
// - Google OAuth sign in
// - Microsoft OAuth sign in  
// - Email/password credentials sign in
// - Session management
// - CSRF protection