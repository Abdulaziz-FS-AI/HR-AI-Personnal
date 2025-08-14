import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { getRoleById, getRoleSkills, getRoleQuestions } from "@/lib/db-roles"
import { RoleDetail } from "@/components/role/role-detail"

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic'

interface RoleDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function RoleDetailPage({ params }: RoleDetailPageProps) {
  const { id } = await params
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/login')
  }

  const role = await getRoleById(id)
  
  if (!role) {
    notFound()
  }
  
  // Ensure user can only access their own roles
  if (role.userId !== session.user.id) {
    notFound()
  }

  // Fetch related data
  const [skills, questions] = await Promise.all([
    getRoleSkills(id),
    getRoleQuestions(id)
  ])

  return (
    <RoleDetail 
      role={role} 
      skills={skills} 
      questions={questions} 
    />
  )
}