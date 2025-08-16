"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { 
  Brain, 
  Lightbulb, 
  AlertTriangle, 
  TrendingUp, 
  Target, 
  Users,
  Clock,
  Award,
  Eye,
  RefreshCw,
  Share,
  BookOpen,
  Zap
} from "lucide-react"

interface AIInsights {
  executiveSummary: string
  keyFindings: string[]
  riskAlerts: string[]
  opportunities: string[]
  recommendations: Array<{
    priority: "CRITICAL" | "HIGH" | "MEDIUM"
    action: string
    expectedImpact: string
    timeline: string
    confidence: number
    category: "PROCESS" | "TALENT" | "STRATEGY" | "TECHNICAL"
  }>
  marketIntelligence: {
    positionVsMarket: string
    talentAvailability: string
    competitiveAdvantage: string[]
    marketTrends: string[]
  }
  predictionInsights: {
    hiringSuccess: {
      confidence: number
      keyFactors: string[]
      riskMitigation: string[]
    }
    talentPipeline: {
      futureProjections: string
      recommendedActions: string[]
    }
  }
}

interface AIInsightsPanelProps {
  insights: AIInsights
  evaluationId: string
}

export function AIInsightsPanel({ insights, evaluationId }: AIInsightsPanelProps) {
  const [activeTab, setActiveTab] = useState("summary")
  const [refreshing, setRefreshing] = useState(false)

  const refreshInsights = async () => {
    setRefreshing(true)
    try {
      // Simulate AI refresh - in production would call API
      await new Promise(resolve => setTimeout(resolve, 2000))
    } finally {
      setRefreshing(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "CRITICAL": return "bg-red-100 text-red-800 border-red-200"
      case "HIGH": return "bg-orange-100 text-orange-800 border-orange-200"
      case "MEDIUM": return "bg-blue-100 text-blue-800 border-blue-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "PROCESS": return <Target className="h-4 w-4" />
      case "TALENT": return <Users className="h-4 w-4" />
      case "STRATEGY": return <Brain className="h-4 w-4" />
      case "TECHNICAL": return <Zap className="h-4 w-4" />
      default: return <Lightbulb className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-blue-600" />
              <CardTitle className="text-blue-900">AI Strategic Intelligence</CardTitle>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshInsights}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button variant="outline" size="sm">
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
          
          <p className="text-blue-800">
            Advanced AI analysis providing strategic insights, predictive intelligence, and actionable recommendations
          </p>
        </CardHeader>
      </Card>

      {/* Main Insights Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="summary">Executive Summary</TabsTrigger>
          <TabsTrigger value="findings">Key Findings</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="market">Market Intelligence</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <div className="space-y-6">
            {/* Executive Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-800 leading-relaxed text-lg">
                  {insights.executiveSummary}
                </p>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-8 w-8 text-green-600" />
                    <div>
                      <div className="text-2xl font-bold text-green-800">
                        {insights.opportunities.length}
                      </div>
                      <div className="text-sm text-green-700">Growth Opportunities</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                    <div>
                      <div className="text-2xl font-bold text-red-800">
                        {insights.riskAlerts.length}
                      </div>
                      <div className="text-sm text-red-700">Risk Alerts</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Brain className="h-8 w-8 text-blue-600" />
                    <div>
                      <div className="text-2xl font-bold text-blue-800">
                        {insights.recommendations.filter(r => r.priority === "CRITICAL" || r.priority === "HIGH").length}
                      </div>
                      <div className="text-sm text-blue-700">Priority Actions</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Opportunities & Risks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-green-200">
                <CardHeader>
                  <CardTitle className="text-green-800 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Top Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.opportunities.slice(0, 3).map((opportunity, index) => (
                      <div key={index} className="flex items-start gap-2 p-3 bg-green-50 rounded border border-green-200">
                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-green-700">{index + 1}</span>
                        </div>
                        <p className="text-sm text-green-800">{opportunity}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="text-red-800 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Critical Risks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.riskAlerts.slice(0, 3).map((risk, index) => (
                      <div key={index} className="flex items-start gap-2 p-3 bg-red-50 rounded border border-red-200">
                        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-800">{risk}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="findings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Key Findings & Insights
              </CardTitle>
              <p className="text-sm text-gray-600">
                Critical discoveries from comprehensive candidate analysis
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {insights.keyFindings.map((finding, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 rounded border">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-blue-700">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 leading-relaxed">{finding}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations">
          <div className="space-y-6">
            {/* Priority Breakdown */}
            <div className="grid grid-cols-3 gap-4">
              {["CRITICAL", "HIGH", "MEDIUM"].map((priority) => {
                const count = insights.recommendations.filter(r => r.priority === priority).length
                return (
                  <Card key={priority} className={getPriorityColor(priority)}>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-sm font-medium">{priority} Priority</div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Recommendations List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Strategic Recommendations
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Prioritized action items with expected impact and timeline
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {insights.recommendations
                    .sort((a, b) => {
                      const priorityOrder = { "CRITICAL": 3, "HIGH": 2, "MEDIUM": 1 }
                      return priorityOrder[b.priority] - priorityOrder[a.priority]
                    })
                    .map((rec, index) => (
                      <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge className={`${getPriorityColor(rec.priority)} border`}>
                              {rec.priority}
                            </Badge>
                            <Badge variant="outline" className="flex items-center gap-1">
                              {getCategoryIcon(rec.category)}
                              {rec.category}
                            </Badge>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-700">
                              Confidence: {rec.confidence}%
                            </div>
                            <Progress value={rec.confidence} className="w-16 h-2 mt-1" />
                          </div>
                        </div>
                        
                        <h4 className="font-semibold text-gray-900 mb-2">{rec.action}</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Expected Impact:</span>
                            <p className="text-gray-800 font-medium">{rec.expectedImpact}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Timeline:</span>
                            <p className="text-gray-800 font-medium flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {rec.timeline}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="market">
          <div className="space-y-6">
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="text-purple-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Market Position Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-purple-800 leading-relaxed">
                  {insights.marketIntelligence.positionVsMarket}
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Talent Availability
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-800 mb-4">{insights.marketIntelligence.talentAvailability}</p>
                  
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900">Market Trends:</h4>
                    {insights.marketIntelligence.marketTrends.map((trend, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700">{trend}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Competitive Advantages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.marketIntelligence.competitiveAdvantage.map((advantage, index) => (
                      <div key={index} className="flex items-start gap-2 p-3 bg-green-50 rounded border border-green-200">
                        <Award className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-green-800">{advantage}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="predictions">
          <div className="space-y-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-900 flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Hiring Success Predictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-blue-800 font-medium">Prediction Confidence</span>
                      <span className="text-2xl font-bold text-blue-900">
                        {insights.predictionInsights.hiringSuccess.confidence}%
                      </span>
                    </div>
                    <Progress value={insights.predictionInsights.hiringSuccess.confidence} className="h-3 mb-4" />
                    
                    <div className="space-y-2">
                      <h4 className="font-semibold text-blue-800">Key Success Factors:</h4>
                      {insights.predictionInsights.hiringSuccess.keyFactors.map((factor, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-blue-700">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          <span>{factor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-blue-800 mb-3">Risk Mitigation Strategies:</h4>
                    <div className="space-y-2">
                      {insights.predictionInsights.hiringSuccess.riskMitigation.map((strategy, index) => (
                        <div key={index} className="flex items-start gap-2 p-2 bg-white rounded border border-blue-200">
                          <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-blue-800">{strategy}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Talent Pipeline Projections
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded border">
                    <h4 className="font-semibold text-gray-900 mb-2">Future Outlook</h4>
                    <p className="text-gray-800">{insights.predictionInsights.talentPipeline.futureProjections}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Recommended Actions:</h4>
                    <div className="space-y-2">
                      {insights.predictionInsights.talentPipeline.recommendedActions.map((action, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-blue-50 rounded border border-blue-200">
                          <Target className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-blue-800">{action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}