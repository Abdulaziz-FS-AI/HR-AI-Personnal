import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { RoleCreationWizard } from "@/components/role/role-creation-wizard"

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic'

export default async function CreateRolePage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/login')
  }

  return (
    <RoleCreationWizard />
  )
}