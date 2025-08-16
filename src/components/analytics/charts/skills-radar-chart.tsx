"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Cell } from 'recharts'
import { Target, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Filter } from "lucide-react"

interface SkillsAnalysisData {
  skillPerformance: Array<{
    skill: string
    required: boolean
    foundRate: number
    averageConfidence: number
    evidenceQuality: number
    marketDemand: "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW"
    gapSeverity: "CRITICAL" | "MODERATE" | "MINOR" | "NONE"
    recommendations: string[]
  }>
  
  gaps: Array<{
    skill: string
    severity: "HIGH" | "MEDIUM" | "LOW"
    impact: number
    recommendation: string
  }>
  
  emergingSkills: Array<{
    skill: string
    frequency: number
    marketValue: number
    futureRelevance: "HIGH" | "MEDIUM" | "LOW"
  }>
}

interface SkillsRadarChartProps {
  data: SkillsAnalysisData
  evaluationId: string
}

export function SkillsRadarChart({ data, evaluationId }: SkillsRadarChartProps) {
  const [activeTab, setActiveTab] = useState("performance")
  const [showOnlyRequired, setShowOnlyRequired] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Prepare radar chart data
  const radarData = data.skillPerformance
    ?.filter(skill => !showOnlyRequired || skill.required)
    ?.map(skill => ({
      skill: skill.skill.length > 12 ? skill.skill.substring(0, 12) + '...' : skill.skill,
      fullSkill: skill.skill,
      foundRate: skill.foundRate,
      confidence: skill.averageConfidence * 10, // Convert to 0-100 scale
      marketDemand: getMarketDemandScore(skill.marketDemand),
      required: skill.required,
      gapSeverity: skill.gapSeverity,
      recommendations: skill.recommendations
    }))
    ?.slice(0, 8) || [] // Limit to 8 skills for readability

  const criticalGaps = data.gaps?.filter(gap => gap.severity === "HIGH") || []
  const emergingSkills = data.emergingSkills?.slice(0, 10) || []

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Skills Intelligence Matrix
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Multi-dimensional skill analysis with market insights
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={showOnlyRequired ? "default" : "outline"}
              size="sm"
              onClick={() => setShowOnlyRequired(!showOnlyRequired)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Required Only
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="gaps">Skill Gaps</TabsTrigger>
            <TabsTrigger value="emerging">Emerging Skills</TabsTrigger>
          </TabsList>

          <TabsContent value="performance">
            <div className="space-y-6">
              {/* Radar Chart */}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis 
                      dataKey="skill" 
                      tick={{ fontSize: 12 }}
                      className="text-xs"
                    />
                    <PolarRadiusAxis 
                      angle={90} 
                      domain={[0, 100]} 
                      tick={{ fontSize: 10 }}
                      tickCount={5}
                    />
                    
                    <Radar
                      name="Found Rate"
                      dataKey="foundRate"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                    
                    <Radar
                      name="Confidence"
                      dataKey="confidence"
                      stroke="#059669"
                      fill="#059669"
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                    
                    <Radar
                      name="Market Demand"
                      dataKey="marketDemand"
                      stroke="#dc2626"
                      fill="#dc2626"
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                    
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Skills Legend */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {radarData.map((skill, index) => (
                  <div key={index} className="p-3 border rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{skill.fullSkill}</span>
                        {skill.required && (
                          <Badge variant="destructive" className="text-xs">Required</Badge>
                        )}
                      </div>
                      
                      <Badge 
                        variant={
                          skill.gapSeverity === "CRITICAL" ? "destructive" :
                          skill.gapSeverity === "MODERATE" ? "default" :
                          "secondary"
                        }
                        className="text-xs"
                      >
                        {skill.gapSeverity}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="text-center">
                        <div className="font-semibold text-blue-600">{skill.foundRate.toFixed(0)}%</div>
                        <div className="text-gray-500">Found</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-green-600">{(skill.confidence / 10).toFixed(1)}/10</div>
                        <div className="text-gray-500">Confidence</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-red-600">{skill.marketDemand.toFixed(0)}</div>
                        <div className="text-gray-500">Market</div>
                      </div>
                    </div>
                    
                    {skill.recommendations.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="text-xs text-gray-600">
                          💡 {skill.recommendations[0]}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="gaps">
            <div className="space-y-4">
              {criticalGaps.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <h3 className="font-semibold text-red-900">Critical Skill Gaps Identified</h3>
                    <Badge variant="destructive">{criticalGaps.length} gaps</Badge>
                  </div>
                  
                  <div className="grid gap-4">
                    {criticalGaps.map((gap, index) => (
                      <Card key={index} className="border-red-200 bg-red-50">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-red-900">{gap.skill}</h4>
                                <Badge variant="destructive" className="text-xs">
                                  {gap.severity} SEVERITY
                                </Badge>
                              </div>
                              
                              <p className="text-sm text-red-700 mb-3">
                                {gap.recommendation}
                              </p>
                              
                              <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-1">
                                  <span className="text-red-600">Impact Score:</span>
                                  <span className="font-semibold">{gap.impact.toFixed(0)}/100</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className="w-16 h-2 bg-red-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-red-600 transition-all"
                                  style={{ width: `${gap.impact}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              ) : (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-8 text-center">
                    <TrendingUp className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-green-900 mb-2">No Critical Gaps</h3>
                    <p className="text-green-700">
                      Your candidate pool shows strong coverage across required skills. 
                      Consider leveraging this as a competitive advantage.
                    </p>
                  </CardContent>
                </Card>
              )}
              
              {/* All Gaps Overview */}
              {data.gaps && data.gaps.length > criticalGaps.length && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-3">Other Skill Gaps</h4>
                  <div className="grid gap-2">
                    {data.gaps
                      .filter(gap => gap.severity !== "HIGH")
                      .map((gap, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{gap.skill}</span>
                            <Badge 
                              variant={gap.severity === "MEDIUM" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {gap.severity}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600">
                            Impact: {gap.impact.toFixed(0)}/100
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="emerging">
            <div className="space-y-4">
              {emergingSkills.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="h-5 w-5 text-yellow-600" />
                    <h3 className="font-semibold text-yellow-900">Emerging Skills Discovered</h3>
                    <Badge variant="secondary">{emergingSkills.length} skills</Badge>
                  </div>
                  
                  <div className="grid gap-4">
                    {emergingSkills.map((skill, index) => (
                      <Card key={index} className="border-yellow-200 bg-yellow-50">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-yellow-900">{skill.skill}</h4>
                                <Badge 
                                  variant={
                                    skill.futureRelevance === "HIGH" ? "default" :
                                    skill.futureRelevance === "MEDIUM" ? "secondary" :
                                    "outline"
                                  }
                                  className="text-xs"
                                >
                                  {skill.futureRelevance} RELEVANCE
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-yellow-700">Frequency:</span>
                                  <div className="font-semibold">{skill.frequency} candidates</div>
                                </div>
                                <div>
                                  <span className="text-yellow-700">Market Value:</span>
                                  <div className="font-semibold">{skill.marketValue}/100</div>
                                </div>
                                <div>
                                  <span className="text-yellow-700">Future Relevance:</span>
                                  <div className="font-semibold">{skill.futureRelevance}</div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className="w-16 h-2 bg-yellow-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-yellow-600 transition-all"
                                  style={{ width: `${skill.marketValue}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-blue-900 mb-2">Strategic Opportunity</h4>
                          <p className="text-sm text-blue-800">
                            These emerging skills weren't in your original requirements but appear 
                            frequently in your candidate pool. Consider:
                          </p>
                          <ul className="list-disc ml-4 mt-2 text-sm text-blue-700 space-y-1">
                            <li>Expanding role requirements to include high-value emerging skills</li>
                            <li>Creating specialized roles that leverage these capabilities</li>
                            <li>Building competitive advantage through early adoption</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="border-gray-200">
                  <CardContent className="p-8 text-center">
                    <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Emerging Skills</h3>
                    <p className="text-gray-600">
                      Candidates closely match your specified requirements without additional skills. 
                      This indicates precise targeting but may limit innovation opportunities.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

// Utility functions
function getMarketDemandScore(demand: "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW"): number {
  const demandMap = {
    "VERY_HIGH": 90,
    "HIGH": 75,
    "MEDIUM": 50,
    "LOW": 25
  }
  
  return demandMap[demand]
}