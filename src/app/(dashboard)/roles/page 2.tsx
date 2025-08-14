import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getRolesByUserId } from "@/lib/db-roles"
import { RolesList } from "@/components/role/roles-list"

export default async function RolesPage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/login')
  }

  const dbRoles = await getRolesByUserId(session.user.id)
  
  // Convert DB roles to the format expected by RolesList
  const roles = dbRoles.map(role => ({
    id: role.id,
    userId: role.userId,
    title: role.title,
    description: role.description || undefined,
    responsibilities: undefined, // Not in DB interface
    department: role.department || undefined,
    location: role.location || undefined,
    employmentType: (role.employmentType || 'full-time') as "full-time" | "part-time" | "contract" | "freelance" | "internship",
    seniorityLevel: 'mid' as "entry" | "junior" | "mid" | "senior" | "lead" | "executive", // Not in DB interface
    minExperienceYears: role.minExperience || 0,
    maxExperienceYears: role.maxExperience || 10,
    educationRequirements: undefined, // Not in DB interface
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    isActive: role.isActive
  }))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Job Roles</h1>
          <p className="text-gray-600">
            Manage your job roles and their requirements for AI-powered resume screening
          </p>
        </div>
      </div>

      <RolesList initialRoles={roles} />
    </div>
  )
}