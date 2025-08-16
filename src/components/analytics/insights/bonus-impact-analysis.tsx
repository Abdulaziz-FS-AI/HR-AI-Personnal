"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertTriangle, 
  Award,
  MinusCircle,
  PlusCircle,
  BarChart3,
  Lightbulb
} from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

interface BonusImpactData {
  impact: {
    averageBonusPoints: number
    averagePenaltyPoints: number
    candidatesImproved: number
    candidatesDeclined: number
    netEffect: number
  }
  effectiveness: {
    bonusEffectiveness: number
    penaltyEffectiveness: number
    overallImpact: number
  }
  activeModules: {
    bonuses: string[]
    penalties: string[]
  }
  moduleBreakdown: Array<{
    module: string
    type: "bonus" | "penalty"
    avgImpact: number
    candidatesAffected: number
    effectiveness: number
  }>
  recommendations: Array<{
    priority: "HIGH" | "MEDIUM" | "LOW"
    action: string
    expectedImprovement: string
  }>
}

interface BonusImpactAnalysisProps {
  data: BonusImpactData
  evaluationId: string
}

export function BonusImpactAnalysis({ data, evaluationId }: BonusImpactAnalysisProps) {
  // Prepare pie chart data for impact distribution
  const impactDistribution = [
    {
      name: "Bonus Impact",
      value: Math.abs(data.impact.averageBonusPoints),
      color: "#10b981",
      count: data.impact.candidatesImproved
    },
    {
      name: "Penalty Impact", 
      value: Math.abs(data.impact.averagePenaltyPoints),
      color: "#ef4444",
      count: data.impact.candidatesDeclined
    }
  ]

  // Prepare bar chart data for module performance
  const moduleData = data.moduleBreakdown.map(module => ({
    name: module.module.length > 15 ? module.module.substring(0, 15) + '...' : module.module,
    fullName: module.module,
    impact: module.avgImpact,
    candidates: module.candidatesAffected,
    effectiveness: module.effectiveness,
    type: module.type
  }))

  const getEffectivenessColor = (effectiveness: number) => {
    if (effectiveness >= 80) return "text-green-600 bg-green-50"
    if (effectiveness >= 60) return "text-yellow-600 bg-yellow-50"
    return "text-red-600 bg-red-50"
  }

  const getImpactIcon = (impact: number) => {
    if (impact > 0) return <TrendingUp className="h-4 w-4 text-green-600" />
    if (impact < 0) return <TrendingDown className="h-4 w-4 text-red-600" />
    return <Target className="h-4 w-4 text-gray-600" />
  }

  return (
    <div className="space-y-6">
      {/* Impact Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">Bonus Impact</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-bold text-green-900">
                    +{data.impact.averageBonusPoints.toFixed(1)}
                  </p>
                  <p className="text-sm text-green-700">pts avg</p>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <PlusCircle className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-700">
                    {data.impact.candidatesImproved} candidates improved
                  </span>
                </div>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <Award className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-800">Penalty Impact</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-bold text-red-900">
                    -{data.impact.averagePenaltyPoints.toFixed(1)}
                  </p>
                  <p className="text-sm text-red-700">pts avg</p>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <MinusCircle className="h-3 w-3 text-red-600" />
                  <span className="text-xs text-red-700">
                    {data.impact.candidatesDeclined} candidates affected
                  </span>
                </div>
              </div>
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">Net Effect</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-bold text-blue-900">
                    {data.impact.netEffect >= 0 ? '+' : ''}{data.impact.netEffect.toFixed(1)}
                  </p>
                  <p className="text-sm text-blue-700">pts net</p>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  {getImpactIcon(data.impact.netEffect)}
                  <span className="text-xs text-blue-700">
                    {data.impact.netEffect >= 0 ? 'Positive' : 'Negative'} overall impact
                  </span>
                </div>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Impact Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Impact Distribution</CardTitle>
            <p className="text-sm text-gray-600">
              Bonus vs penalty point allocation across candidates
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={impactDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    stroke="none"
                  >
                    {impactDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toFixed(1)} pts avg (${props.payload.count} candidates)`,
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              {impactDistribution.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <div className="text-sm">
                    <span className="font-medium">{item.name}</span>
                    <div className="text-xs text-gray-500">
                      {item.value.toFixed(1)} pts • {item.count} candidates
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Module Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Module Performance</CardTitle>
            <p className="text-sm text-gray-600">
              Average impact per bonus/penalty module
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moduleData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => {
                      const data = props.payload
                      return [
                        `${value.toFixed(1)} pts avg (${data.candidates} candidates)`,
                        data.fullName
                      ]
                    }}
                  />
                  <Bar 
                    dataKey="impact" 
                    fill={(entry: any) => entry.type === 'bonus' ? '#10b981' : '#ef4444'}
                  >
                    {moduleData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.type === 'bonus' ? '#10b981' : '#ef4444'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Module Details */}
      <Card>
        <CardHeader>
          <CardTitle>Module Effectiveness Analysis</CardTitle>
          <p className="text-sm text-gray-600">
            Detailed breakdown of each bonus and penalty module
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Bonus Modules */}
            <div>
              <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                <Award className="h-4 w-4" />
                Bonus Modules ({data.activeModules.bonuses.length})
              </h4>
              <div className="grid gap-3">
                {data.moduleBreakdown
                  .filter(module => module.type === 'bonus')
                  .map((module, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded border border-green-200">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-green-900">{module.module}</span>
                          <Badge variant="outline" className="text-xs">
                            +{module.avgImpact.toFixed(1)} pts avg
                          </Badge>
                        </div>
                        <div className="text-sm text-green-700">
                          {module.candidatesAffected} candidates affected
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`text-sm font-medium px-2 py-1 rounded ${getEffectivenessColor(module.effectiveness)}`}>
                          {module.effectiveness.toFixed(0)}% effective
                        </div>
                        <Progress value={module.effectiveness} className="w-16 h-2 mt-1" />
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <Separator />

            {/* Penalty Modules */}
            <div>
              <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Penalty Modules ({data.activeModules.penalties.length})
              </h4>
              <div className="grid gap-3">
                {data.moduleBreakdown
                  .filter(module => module.type === 'penalty')
                  .map((module, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded border border-red-200">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-red-900">{module.module}</span>
                          <Badge variant="outline" className="text-xs">
                            {module.avgImpact.toFixed(1)} pts avg
                          </Badge>
                        </div>
                        <div className="text-sm text-red-700">
                          {module.candidatesAffected} candidates affected
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`text-sm font-medium px-2 py-1 rounded ${getEffectivenessColor(module.effectiveness)}`}>
                          {module.effectiveness.toFixed(0)}% effective
                        </div>
                        <Progress value={module.effectiveness} className="w-16 h-2 mt-1" />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optimization Recommendations */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-blue-900">Optimization Recommendations</CardTitle>
          </div>
          <p className="text-sm text-blue-700">
            AI-powered suggestions to improve bonus/penalty effectiveness
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.recommendations.map((rec, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-white rounded border border-blue-200">
                <Badge 
                  variant={rec.priority === 'HIGH' ? 'destructive' : rec.priority === 'MEDIUM' ? 'default' : 'secondary'}
                  className="text-xs mt-0.5"
                >
                  {rec.priority}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm text-blue-900 font-medium mb-1">{rec.action}</p>
                  <p className="text-xs text-blue-700">Expected improvement: {rec.expectedImprovement}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-3 border-t border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">Overall System Effectiveness</span>
              <span className="text-lg font-bold text-blue-900">
                {data.effectiveness.overallImpact.toFixed(0)}%
              </span>
            </div>
            <Progress value={data.effectiveness.overallImpact} className="h-3 mt-2" />
            <p className="text-xs text-blue-700 mt-1">
              {data.effectiveness.overallImpact >= 80 
                ? "Excellent configuration - system is performing optimally"
                : data.effectiveness.overallImpact >= 60
                ? "Good performance - consider minor adjustments"
                : "Room for improvement - review configuration and consider recommendations"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}