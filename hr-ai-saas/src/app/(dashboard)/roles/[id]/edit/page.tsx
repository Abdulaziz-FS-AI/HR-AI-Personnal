import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { getRoleById, getRoleSkills, getRoleQuestions } from "@/lib/db-roles"
import { RoleCreationWizard } from "@/components/role/role-creation-wizard"

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic'

interface EditRolePageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditRolePage({ params }: EditRolePageProps) {
  const { id } = await params
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/login')
  }

  const role = await getRoleById(id)
  
  if (!role) {
    notFound()
  }
  
  // Ensure user can only edit their own roles
  if (role.userId !== session.user.id) {
    notFound()
  }
  
  if (!role) {
    notFound()
  }

  // Fetch related data
  const [skills, questions] = await Promise.all([
    getRoleSkills(id),
    getRoleQuestions(id)
  ])

  const initialData = {
    job: {
      title: role.title,
      description: role.description || "",
      responsibilities: role.responsibilities || "",
      department: role.department || "",
      location: role.location || "",
      employmentType: (role.employmentType || 'full-time') as "full-time" | "part-time" | "contract" | "freelance" | "internship",
      seniorityLevel: (role.seniorityLevel || 'mid') as "entry" | "junior" | "mid" | "senior" | "lead" | "executive",
      minExperienceYears: role.minExperienceYears || 0,
      maxExperienceYears: role.maxExperienceYears || 10,
      educationRequirements: role.educationRequirements || "",
    },
    skills: skills.map(skill => ({
      skillName: skill.skillName,
      weight: skill.weight,
      isRequired: skill.isRequired,
      roleId: role.id,
      skillCategory: skill.skillCategory || undefined
    })),
    questions: questions.map(question => ({
      questionText: question.questionText,
      weight: question.weight,
      roleId: role.id,
      category: question.category || undefined
    }))
  }

  return (
    <RoleCreationWizard 
      initialData={initialData}
      isEditing={true}
      roleId={id}
    />
  )
}