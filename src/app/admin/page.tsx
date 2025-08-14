import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Dashboard - HR AI SaaS",
  description: "Monitor users, usage, and system performance"
}

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Monitor your HR AI SaaS application</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
            <p className="text-2xl font-bold text-blue-600" id="total-users">Loading...</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Active Evaluations</h3>
            <p className="text-2xl font-bold text-green-600" id="active-evaluations">Loading...</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total Roles</h3>
            <p className="text-2xl font-bold text-purple-600" id="total-roles">Loading...</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Files Processed</h3>
            <p className="text-2xl font-bold text-orange-600" id="files-processed">Loading...</p>
          </div>
        </div>

        {/* Recent Users Table */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recent Users</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evaluations</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                </tr>
              </thead>
              <tbody id="users-table" className="bg-white divide-y divide-gray-200">
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">Loading users...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Usage Chart Placeholder */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Daily Usage (Last 30 Days)</h2>
          <div id="usage-chart" className="h-64 bg-gray-100 rounded flex items-center justify-center">
            <p className="text-gray-500">Usage chart will load here</p>
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{
        __html: `
          // Load analytics data
          fetch('/api/admin/analytics')
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                const { userStats, roleStats, evalStats, recentUsers, dailyUsage } = data.data;
                
                // Update stats
                document.getElementById('total-users').textContent = userStats.totalUsers;
                document.getElementById('active-evaluations').textContent = evalStats.processingEvaluations;
                document.getElementById('total-roles').textContent = roleStats.totalRoles;
                document.getElementById('files-processed').textContent = 
                  dailyUsage.reduce((sum, day) => sum + (day.filesProcessed || 0), 0);
                
                // Update users table
                const tbody = document.getElementById('users-table');
                tbody.innerHTML = recentUsers.map(user => \`
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">\${user.email}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">\${user.company_name || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">\${user.roleCount}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">\${user.evaluationCount}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">\${new Date(user.created_at).toLocaleDateString()}</td>
                  </tr>
                \`).join('');
              }
            })
            .catch(err => console.error('Failed to load analytics:', err));
        `
      }} />
    </div>
  )
}