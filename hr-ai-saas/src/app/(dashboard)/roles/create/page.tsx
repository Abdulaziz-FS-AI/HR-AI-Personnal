import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { RoleCreationWizard } from "@/components/role/role-creation-wizard"

export default async function CreateRolePage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/login')
  }

  return (
    <RoleCreationWizard />
  )
}