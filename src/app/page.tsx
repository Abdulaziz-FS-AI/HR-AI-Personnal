"use client"

import { useSession } from "next-auth/react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  useEffect(() => {
    if (status === "loading") return // Still loading
    
    if (session) {
      router.replace("/dashboard")
    } else {
      router.replace("/login")
    }
  }, [session, status, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p>Loading...</p>
      </div>
    </div>
  )
}
