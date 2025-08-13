"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock,
  Award,
  Target,
  FileText,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Zap
} from 'lucide-react'

interface AnalyticsData {
  totalEvaluations: number
  totalResumes: number
  averageProcessingTime: number
  topSkillsInDemand: Array<{ skill: string; count: number; percentage: number }>
  evaluationTrends: Array<{ month: string; evaluations: number; avgScore: number }>
  rolePerformance: Array<{ role: string; totalCandidates: number; avgScore: number; topCandidates: number }>
  candidateDistribution: Array<{ scoreRange: string; count: number; percentage: number }>
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('last-30-days')
  const [selectedRole, setSelectedRole] = useState('all')
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    totalEvaluations: 0,
    totalResumes: 0,
    averageProcessingTime: 0,
    topSkillsInDemand: [],
    evaluationTrends: [],
    rolePerformance: [],
    candidateDistribution: []
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchAnalyticsData()
  }, [timeRange, selectedRole])

  const fetchAnalyticsData = async () => {
    setIsLoading(true)
    try {
      // In a real implementation, this would fetch from analytics API
      // For now, we'll leave it empty for new users
      const response = await fetch(`/api/analytics?timeRange=${timeRange}&role=${selectedRole}`)
      if (response.ok) {
        const data = await response.json()
        setAnalyticsData(data.data || {
          totalEvaluations: 0,
          totalResumes: 0,
          averageProcessingTime: 0,
          topSkillsInDemand: [],
          evaluationTrends: [],
          rolePerformance: [],
          candidateDistribution: []
        })
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
      // Keep empty state on error
    } finally {
      setIsLoading(false)
    }
  }

  const hasData = analyticsData.totalEvaluations > 0

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">
            Insights and trends from your hiring process
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-48">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last-7-days">Last 7 days</SelectItem>
              <SelectItem value="last-30-days">Last 30 days</SelectItem>
              <SelectItem value="last-90-days">Last 90 days</SelectItem>
              <SelectItem value="last-year">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {!hasData ? (
        <div className="text-center py-16">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Analytics Data Yet</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Complete your first evaluation to see insights and trends from your hiring process.
          </p>
          <div className="space-x-3">
            <Button asChild>
              <a href="/dashboard/roles/create">Create Job Role</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/dashboard/evaluations/create">Start Evaluation</a>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Evaluations</p>
                <p className="text-3xl font-bold text-blue-600">{analyticsData.totalEvaluations}</p>
                {analyticsData.totalEvaluations > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    <TrendingUp className="w-3 h-3 inline mr-1" />
                    +15% from last month
                  </p>
                )}
              </div>
              <BarChart3 className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Resumes Processed</p>
                <p className="text-3xl font-bold text-green-600">{analyticsData.totalResumes}</p>
                {analyticsData.totalResumes > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    <TrendingUp className="w-3 h-3 inline mr-1" />
                    +28% from last month
                  </p>
                )}
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Processing Time</p>
                <p className="text-3xl font-bold text-purple-600">{analyticsData.averageProcessingTime}m</p>
                <p className="text-xs text-green-600 mt-1">
                  <TrendingUp className="w-3 h-3 inline mr-1" />
                  12% faster
                </p>
              </div>
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Top Candidates</p>
                <p className="text-3xl font-bold text-orange-600">95</p>
                <p className="text-xs text-green-600 mt-1">
                  <Award className="w-3 h-3 inline mr-1" />
                  19% success rate
                </p>
              </div>
              <Award className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Candidate Score Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Candidate Score Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsData.candidateDistribution.map((range, index) => (
              <div key={range.scoreRange} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{range.scoreRange}</span>
                  <span className="text-gray-600">{range.count} candidates ({range.percentage}%)</span>
                </div>
                <Progress 
                  value={range.percentage} 
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Skills in Demand */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Most In-Demand Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData.topSkillsInDemand.map((skill, index) => (
                <div key={skill.skill} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-700">#{index + 1}</span>
                      <span className="font-medium">{skill.skill}</span>
                    </div>
                    <span className="text-sm text-gray-600">{skill.count} mentions</span>
                  </div>
                  <Progress value={skill.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Role Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Role Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData.rolePerformance.map((role) => (
                <div key={role.role} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{role.role}</h4>
                    <span className="text-sm text-gray-600">{role.totalCandidates} candidates</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Avg Score:</span>
                      <span className="ml-2 font-semibold text-blue-600">{role.avgScore}%</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Top Candidates:</span>
                      <span className="ml-2 font-semibold text-green-600">{role.topCandidates}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evaluation Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Evaluation Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-600 border-b pb-2">
              <span>Month</span>
              <span>Evaluations</span>
              <span>Avg Score</span>
            </div>
            {analyticsData.evaluationTrends.map((trend) => (
              <div key={trend.month} className="flex items-center justify-between py-2">
                <span className="font-medium">{trend.month}</span>
                <span className="text-blue-600 font-semibold">{trend.evaluations}</span>
                <span className="text-green-600 font-semibold">{trend.avgScore}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Insights & Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Eye className="w-5 h-5 mr-2" />
            Insights & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
              <h4 className="font-semibold text-blue-800 mb-1">Skill Trend Alert</h4>
              <p className="text-blue-700 text-sm">
                React and TypeScript skills are highly sought after. Consider creating specialized roles for these technologies.
              </p>
            </div>
            
            <div className="p-4 bg-green-50 border-l-4 border-green-400 rounded">
              <h4 className="font-semibold text-green-800 mb-1">Performance Insight</h4>
              <p className="text-green-700 text-sm">
                DevOps Engineer roles show the highest average candidate scores (85%). Consider expanding in this area.
              </p>
            </div>
            
            <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
              <h4 className="font-semibold text-yellow-800 mb-1">Optimization Opportunity</h4>
              <p className="text-yellow-700 text-sm">
                25% of candidates score below 60%. Consider refining job requirements or expanding talent sources.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
        </>
      )}
    </div>
  )
}