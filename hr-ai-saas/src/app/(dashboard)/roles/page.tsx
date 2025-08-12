import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getUserRoles } from "@/lib/db-secure"
import { RolesList } from "@/components/role/roles-list"

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic'

export default async function RolesPage() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      redirect('/login')
    }

    const dbRoles = await getUserRoles(session.user.id)
    
    // Convert DB roles to the format expected by RolesList
    const roles = dbRoles.map(role => ({
      id: role.id,
      userId: role.userId,
      title: role.title,
      description: role.description || undefined,
      responsibilities: role.responsibilities || undefined,
      department: role.department || undefined,
      location: role.location || undefined,
      employmentType: (role.employmentType || 'full-time') as "full-time" | "part-time" | "contract" | "freelance" | "internship",
      seniorityLevel: (role.seniorityLevel || 'mid') as "entry" | "junior" | "mid" | "senior" | "lead" | "executive",
      minExperienceYears: role.minExperienceYears || 0,
      maxExperienceYears: role.maxExperienceYears || 10,
      educationRequirements: role.educationRequirements || undefined,
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
  } catch (error) {
    console.error('Error in RolesPage:', error)
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Job Roles</h1>
            <p className="text-gray-600">
              Unable to load roles at this time. Please try again later.
            </p>
          </div>
        </div>

        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">There was an error loading your job roles.</p>
          <p className="text-sm text-gray-400">Error ID: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    )
  }
}