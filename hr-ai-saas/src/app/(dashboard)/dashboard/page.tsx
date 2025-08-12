import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getUserByEmail, getRolesByUserId } from "@/lib/db"
import { getDbConnection } from "@/lib/db"
import sql from 'mssql'

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  // Fetch real dashboard data
  let dashboardStats = {
    creditsRemaining: 0,
    totalEvaluations: 0,
    resumesProcessed: 0,
    totalRoles: 0,
    hasCreatedRole: false
  }

  try {
    // Get user data for credits
    if (session.user?.email) {
      const user = await getUserByEmail(session.user.email)
      if (user) {
        dashboardStats.creditsRemaining = user.creditsRemaining
      }
    }

    // Get roles count
    if (session.user?.id) {
      const roles = await getRolesByUserId(session.user.id)
      dashboardStats.totalRoles = roles.length
      dashboardStats.hasCreatedRole = roles.length > 0
    }

    // Get evaluation stats
    const pool = await getDbConnection()
    const evaluationStatsResult = await pool.request()
      .input('userId', sql.NVarChar, session.user.id)
      .query(`
        SELECT 
          COUNT(*) as totalEvaluations,
          ISNULL(SUM(total_files), 0) as resumesProcessed
        FROM evaluation_sessions 
        WHERE user_id = @userId
      `)
    
    if (evaluationStatsResult.recordset[0]) {
      dashboardStats.totalEvaluations = evaluationStatsResult.recordset[0].totalEvaluations
      dashboardStats.resumesProcessed = evaluationStatsResult.recordset[0].resumesProcessed
    }

    await pool.close()
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    // Use defaults on error
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back{session.user?.name ? `, ${session.user.name}` : ''}!
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
            <Link href="/roles/create">
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
              Select a role and upload resumes for AI-powered analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/evaluations/create">
              <Button className="w-full">
                Start New Evaluation
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
            <Link href="/evaluations">
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
                <span className="font-semibold">{dashboardStats.creditsRemaining}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Evaluations</span>
                <span className="font-semibold">{dashboardStats.totalEvaluations}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Resumes Processed</span>
                <span className="font-semibold">{dashboardStats.resumesProcessed}</span>
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
                <div className={`w-2 h-2 rounded-full ${dashboardStats.hasCreatedRole ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className={`text-sm ${dashboardStats.hasCreatedRole ? 'text-gray-900' : 'text-gray-600'}`}>
                  {dashboardStats.hasCreatedRole ? `Created ${dashboardStats.totalRoles} job role${dashboardStats.totalRoles !== 1 ? 's' : ''}` : 'Create your first job role'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${dashboardStats.totalEvaluations > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className={`text-sm ${dashboardStats.totalEvaluations > 0 ? 'text-gray-900' : 'text-gray-600'}`}>
                  {dashboardStats.totalEvaluations > 0 ? `Completed ${dashboardStats.totalEvaluations} evaluation${dashboardStats.totalEvaluations !== 1 ? 's' : ''}` : 'Start evaluation with resumes'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}