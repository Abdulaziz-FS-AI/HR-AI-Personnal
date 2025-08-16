"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { 
  BarChart, 
  LineChart, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target, 
  Award, 
  AlertTriangle,
  Brain,
  Download,
  RefreshCw,
  Filter,
  Eye,
  MoreVertical
} from "lucide-react"
import { ScoreDistributionChart } from "./charts/score-distribution-chart"
import { SkillsRadarChart } from "./charts/skills-radar-chart"
import { TrendsLineChart } from "./charts/trends-line-chart"
import { CandidateComparisonTable } from "./tables/candidate-comparison-table"
import { BonusImpactAnalysis } from "./insights/bonus-impact-analysis"
import { AIInsightsPanel } from "./insights/ai-insights-panel"
import { ExportReportDialog } from "./export/export-report-dialog"

interface AnalyticsData {
  evaluationId: string
  roleId: string
  roleName: string
  totalCandidates: number
  
  metrics: {
    averageScore: number
    scoreStandardDeviation: number
    qualifiedCount: number
    strongFitCount: number
    confidenceDistribution: {
      high: number
      medium: number
      low: number
    }
    scoreDistribution: any
  }
  
  trends: {
    weekOverWeekChange: {
      evaluated: number
      averageScore: number
      qualityPipeline: number
    }
    qualityPipeline: number
    marketBenchmark: number
  }
  
  skillsAnalysis: any
  bonusPenaltyImpact?: any
  predictions: any
  aiInsights: {
    executiveSummary: string
    keyFindings: string[]
    riskAlerts: string[]
    opportunities: string[]
    recommendations: Array<{
      priority: "CRITICAL" | "HIGH" | "MEDIUM"
      action: string
      expectedImpact: string
      timeline: string
    }>
  }
  
  generatedAt: string
}

export function AdvancedAnalyticsDashboard() {
  const params = useParams()
  const searchParams = useSearchParams()
  const evaluationId = params?.evaluationId as string
  
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  useEffect(() => {
    if (evaluationId) {
      loadAnalytics()
    }
  }, [evaluationId])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/analytics/evaluation/${evaluationId}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load analytics')
      }

      setAnalyticsData(result.data)
    } catch (err) {
      console.error('Analytics loading error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const refreshAnalytics = async () => {
    try {
      setRefreshing(true)
      
      const response = await fetch(`/api/analytics/evaluation/${evaluationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: true })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to refresh analytics')
      }
      
      setAnalyticsData(result.data)
    } catch (err) {
      console.error('Analytics refresh error:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh analytics')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="border-red-200">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-900 mb-2">Analytics Error</h3>
              <p className="text-red-700 mb-4">{error}</p>
              <Button onClick={loadAnalytics} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!analyticsData) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">No analytics data available</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Brain className="h-8 w-8 text-blue-600" />
                AI Talent Intelligence
              </h1>
              <p className="text-gray-600 mt-1">
                {analyticsData.roleName} • {analyticsData.totalCandidates} Candidates Analyzed
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm">
                Generated {new Date(analyticsData.generatedAt).toLocaleString()}
              </Badge>
              
              <Button
                variant="outline"
                size="sm"
                onClick={refreshAnalytics}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button
                variant="default"
                size="sm"
                onClick={() => setExportDialogOpen(true)}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* AI Executive Summary */}
        <Card className="mb-8 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-blue-900">AI Executive Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-blue-800 leading-relaxed mb-4">
              {analyticsData.aiInsights.executiveSummary}
            </p>
            
            {analyticsData.aiInsights.recommendations.length > 0 && (
              <div className="border-t border-blue-200 pt-4">
                <h4 className="font-semibold text-blue-900 mb-2">🎯 Immediate Recommendations:</h4>
                <div className="space-y-2">
                  {analyticsData.aiInsights.recommendations.slice(0, 2).map((rec, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Badge 
                        variant={rec.priority === 'CRITICAL' ? 'destructive' : rec.priority === 'HIGH' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {rec.priority}
                      </Badge>
                      <p className="text-sm text-blue-800 flex-1">{rec.action}</p>
                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                        {rec.timeline}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Total Evaluated"
            value={analyticsData.totalCandidates}
            trend={analyticsData.trends.weekOverWeekChange.evaluated}
            icon={Users}
            color="blue"
          />
          
          <KPICard
            title="Average Score"
            value={`${analyticsData.metrics.averageScore.toFixed(1)}%`}
            trend={analyticsData.trends.weekOverWeekChange.averageScore}
            icon={Target}
            color="green"
          />
          
          <KPICard
            title="Strong Fit"
            value={analyticsData.metrics.strongFitCount}
            subtitle={`${((analyticsData.metrics.strongFitCount / analyticsData.totalCandidates) * 100).toFixed(1)}%`}
            icon={Award}
            color="purple"
          />
          
          <KPICard
            title="Quality Pipeline"
            value={`${analyticsData.trends.qualityPipeline}%`}
            trend={analyticsData.trends.weekOverWeekChange.qualityPipeline}
            icon={TrendingUp}
            color="orange"
          />
        </div>

        {/* Analytics Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-6 w-full lg:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="skills">Skills Analysis</TabsTrigger>
            <TabsTrigger value="candidates">Top Candidates</TabsTrigger>
            <TabsTrigger value="bonus-impact">Impact Analysis</TabsTrigger>
            <TabsTrigger value="predictions">Predictions</TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ScoreDistributionChart 
                data={analyticsData.metrics.scoreDistribution}
                evaluationId={evaluationId}
              />
              
              <TrendsLineChart 
                data={analyticsData.trends}
                evaluationId={evaluationId}
              />
            </div>
          </TabsContent>

          <TabsContent value="skills">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SkillsRadarChart 
                data={analyticsData.skillsAnalysis}
                evaluationId={evaluationId}
              />
              
              <Card>
                <CardHeader>
                  <CardTitle>Skills Performance Matrix</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analyticsData.skillsAnalysis.skillPerformance?.slice(0, 8).map((skill: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{skill.skill}</span>
                            {skill.required && (
                              <Badge variant="destructive" className="text-xs">Required</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>Found: {skill.foundRate.toFixed(1)}%</span>
                            <span>Confidence: {skill.averageConfidence.toFixed(1)}/10</span>
                            <Badge variant="outline" className="text-xs">
                              {skill.marketDemand}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <Progress value={skill.foundRate} className="w-24 h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="candidates">
            <CandidateComparisonTable 
              evaluationId={evaluationId}
              totalCandidates={analyticsData.totalCandidates}
            />
          </TabsContent>

          <TabsContent value="bonus-impact">
            {analyticsData.bonusPenaltyImpact ? (
              <BonusImpactAnalysis 
                data={analyticsData.bonusPenaltyImpact}
                evaluationId={evaluationId}
              />
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Bonus/Penalty Configuration</h3>
                  <p className="text-gray-600 mb-4">
                    This evaluation was conducted without bonus/penalty modules. 
                    Configure advanced scoring to unlock strategic insights.
                  </p>
                  <Button variant="outline">
                    Learn About Advanced Scoring
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="predictions">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Hiring Success Predictions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Success Probability</span>
                        <span className="text-2xl font-bold text-green-600">
                          {analyticsData.predictions.hiringSuccess.probability.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={analyticsData.predictions.hiringSuccess.probability} className="h-3" />
                      <p className="text-xs text-gray-500 mt-1">
                        Confidence: ±{(analyticsData.predictions.hiringSuccess.confidenceInterval[1] - analyticsData.predictions.hiringSuccess.confidenceInterval[0]).toFixed(1)}%
                      </p>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h4 className="font-semibold mb-3">Key Success Factors</h4>
                      <div className="space-y-2">
                        {analyticsData.predictions.hiringSuccess.keyFactors.map((factor: any, index: number) => (
                          <div key={index} className="flex items-center justify-between">
                            <span className="text-sm">{factor.factor}</span>
                            <div className="flex items-center gap-2">
                              <Progress value={factor.impact * 100} className="w-16 h-2" />
                              <span className="text-xs text-gray-500">
                                {(factor.impact * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Retention Projections</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-green-50 p-3 rounded">
                        <div className="text-lg font-bold text-green-600">
                          {analyticsData.predictions.retention.probabilityAt6Months.toFixed(0)}%
                        </div>
                        <div className="text-xs text-green-700">6 Months</div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded">
                        <div className="text-lg font-bold text-blue-600">
                          {analyticsData.predictions.retention.probabilityAt12Months.toFixed(0)}%
                        </div>
                        <div className="text-xs text-blue-700">12 Months</div>
                      </div>
                      <div className="bg-purple-50 p-3 rounded">
                        <div className="text-lg font-bold text-purple-600">
                          {analyticsData.predictions.retention.probabilityAt24Months.toFixed(0)}%
                        </div>
                        <div className="text-xs text-purple-700">24 Months</div>
                      </div>
                    </div>
                    
                    {analyticsData.predictions.retention.riskFactors.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold mb-2 text-red-700">Risk Factors</h4>
                          <div className="space-y-1">
                            {analyticsData.predictions.retention.riskFactors.map((risk: string, index: number) => (
                              <div key={index} className="flex items-center gap-2 text-sm text-red-600">
                                <AlertTriangle className="h-3 w-3" />
                                <span>{risk}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="insights">
            <AIInsightsPanel 
              insights={analyticsData.aiInsights}
              evaluationId={evaluationId}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Export Dialog */}
      <ExportReportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        evaluationId={evaluationId}
        analyticsData={analyticsData}
      />
    </div>
  )
}

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: number
  icon: any
  color: 'blue' | 'green' | 'purple' | 'orange'
}

function KPICard({ title, value, subtitle, trend, icon: Icon, color }: KPICardProps) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50 border-blue-200',
    green: 'text-green-600 bg-green-50 border-green-200',
    purple: 'text-purple-600 bg-purple-50 border-purple-200',
    orange: 'text-orange-600 bg-orange-50 border-orange-200'
  }

  return (
    <Card className={`${colorClasses[color]} border`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold">{value}</p>
              {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
            </div>
            
            {trend !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {trend >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500">vs last week</span>
              </div>
            )}
          </div>
          
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}