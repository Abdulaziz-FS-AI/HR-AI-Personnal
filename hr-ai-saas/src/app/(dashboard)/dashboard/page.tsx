import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getUserDashboardStats } from "@/lib/db-dashboard"

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  // Fetch real user statistics
  const stats = await getUserDashboardStats(session.user?.id || '')
  
  // Default values if stats fetch fails
  const dashboardData = stats || {
    creditsRemaining: 0,
    totalEvaluations: 0,
    resumesProcessed: 0,
    completedSteps: {
      accountCreated: true,
      firstRoleCreated: false,
      firstAnalysisCompleted: false
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {session.user?.name}
        </h1>
        <p className="text-gray-600">
          Ready to screen some resumes with AI?
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Create Job Role</CardTitle>
            <CardDescription>
              Define a new job role with requirements and custom questions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/roles/create">
              <Button className="w-full">
                Create Role
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Start Evaluation</CardTitle>
            <CardDescription>
              Upload resumes and get AI-powered candidate analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/evaluations/create">
              <Button className="w-full">
                Start Evaluation
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>View Results</CardTitle>
            <CardDescription>
              Review past evaluations and candidate rankings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/evaluations">
              <Button className="w-full" variant="outline">
                View Evaluations
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Credits Remaining</span>
                <span className="font-semibold">{dashboardData.creditsRemaining}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Evaluations</span>
                <span className="font-semibold">{dashboardData.totalEvaluations}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Resumes Processed</span>
                <span className="font-semibold">{dashboardData.resumesProcessed}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">Account created</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 ${dashboardData.completedSteps.firstRoleCreated ? 'bg-green-500' : 'bg-gray-300'} rounded-full`}></div>
                <span className={`text-sm ${dashboardData.completedSteps.firstRoleCreated ? '' : 'text-gray-600'}`}>
                  {dashboardData.completedSteps.firstRoleCreated ? 'First job role created' : 'Create your first job role'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 ${dashboardData.completedSteps.firstAnalysisCompleted ? 'bg-green-500' : 'bg-gray-300'} rounded-full`}></div>
                <span className={`text-sm ${dashboardData.completedSteps.firstAnalysisCompleted ? '' : 'text-gray-600'}`}>
                  {dashboardData.completedSteps.firstAnalysisCompleted ? 'Resume analysis completed' : 'Upload and analyze resumes'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}