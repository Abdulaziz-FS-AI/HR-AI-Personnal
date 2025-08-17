import { RoleCreationWizard } from "@/components/role/role-creation-wizard"

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic'

export default function CreateRolePage() {
  // For now, remove authentication check to fix 404 error
  // Authentication will be handled by the API routes when making requests
  
  return (
    <RoleCreationWizard />
  )
}