import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { createUser, getUserByEmail } from "@/lib/db"
import { z } from "zod"

// Registration validation schema
const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  firstName: z.string().min(1, "First name is required").max(50, "First name too long"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name too long"),
  companyName: z.string().min(1, "Company name is required").max(100, "Company name too long")
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input with Zod
    const validationResult = registerSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false,
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }

    const { email, password, firstName, lastName, companyName } = validationResult.data

    // Check if user already exists
    const existingUser = await getUserByEmail(email)
    if (existingUser) {
      return NextResponse.json(
        { 
          success: false,
          message: "User with this email already exists" 
        },
        { status: 409 }
      )
    }

    // Hash password with high cost factor for security
    const passwordHash = await hash(password, 12)

    // Create user in Azure SQL Database
    const user = await createUser({
      email,
      passwordHash,
      firstName,
      lastName,
      companyName,
    })

    if (!user) {
      return NextResponse.json(
        { 
          success: false,
          message: "Failed to create user - database error" 
        },
        { status: 500 }
      )
    }

    // Return success without exposing sensitive data
    return NextResponse.json(
      { 
        success: true,
        message: "User created successfully", 
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    
    // Don't expose internal error details to client
    return NextResponse.json(
      { 
        success: false,
        message: "Internal server error - please try again later" 
      },
      { status: 500 }
    )
  }
}