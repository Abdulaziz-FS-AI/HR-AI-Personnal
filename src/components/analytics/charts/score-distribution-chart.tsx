"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { TrendingUp, Users, AlertTriangle, Eye, Info } from "lucide-react"

interface ScoreDistributionData {
  ranges: {
    [key: string]: {
      count: number
      percentage: number
      candidates: string[]
      label: string
      aiInsight: string
      recommendedAction: string
    }
  }
  statistics: {
    mean: number
    median: number
    standardDeviation: number
    confidence95: [number, number]
    skewness: number
    kurtosis: number
  }
  quality: {
    highConfidencePercent: number
    evidenceStrength: number
    biasScore: number
    diversityIndex: number
  }
}

interface ScoreDistributionChartProps {
  data: ScoreDistributionData
  evaluationId: string
}

export function ScoreDistributionChart({ data, evaluationId }: ScoreDistributionChartProps) {
  const [selectedRange, setSelectedRange] = useState<string | null>(null)
  const [showStats, setShowStats] = useState(false)

  // Transform data for chart
  const chartData = Object.entries(data.ranges).map(([range, values]) => ({
    range,
    count: values.count,
    percentage: values.percentage,
    label: values.label,
    color: getScoreColor(range),
    candidates: values.candidates,
    aiInsight: values.aiInsight,
    recommendedAction: values.recommendedAction
  })).sort((a, b) => {
    // Sort by score range (highest first)
    const aMin = parseInt(a.range.split('-')[0])
    const bMin = parseInt(b.range.split('-')[0])
    return bMin - aMin
  })

  const totalCandidates = chartData.reduce((sum, item) => sum + item.count, 0)

  const handleBarClick = (data: any) => {
    setSelectedRange(selectedRange === data.range ? null : data.range)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Score Distribution Analysis
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Interactive score breakdown with AI insights
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStats(!showStats)}
            >
              <Info className="h-4 w-4 mr-2" />
              {showStats ? 'Hide' : 'Show'} Stats
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-6">
          {/* Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="range" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Candidates', angle: -90, position: 'insideLeft' }}
                />
                
                {/* Reference lines for mean and median */}
                <ReferenceLine 
                  x={findRangeForScore(data.statistics.mean, chartData)} 
                  stroke="#2563eb" 
                  strokeDasharray="8 8"
                  label={{ value: `Mean: ${data.statistics.mean.toFixed(1)}`, position: "topLeft" }}
                />
                <ReferenceLine 
                  x={findRangeForScore(data.statistics.median, chartData)} 
                  stroke="#dc2626" 
                  strokeDasharray="4 4"
                  label={{ value: `Median: ${data.statistics.median.toFixed(1)}`, position: "topRight" }}
                />
                
                <Bar 
                  dataKey="count" 
                  cursor="pointer"
                  onClick={handleBarClick}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      fillOpacity={selectedRange === entry.range ? 1.0 : 0.8}
                      stroke={selectedRange === entry.range ? "#1f2937" : "none"}
                      strokeWidth={selectedRange === entry.range ? 2 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Score Range Legend */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            {chartData.map((item) => (
              <TooltipProvider key={item.range}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedRange === item.range 
                          ? 'ring-2 ring-blue-500 bg-blue-50' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleBarClick(item)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div 
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: item.color }}
                        ></div>
                        <span className="text-xs font-medium">{item.range}</span>
                      </div>
                      <div className="text-sm font-semibold">{item.count} candidates</div>
                      <div className="text-xs text-gray-500">{item.percentage.toFixed(1)}%</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="max-w-xs">
                      <div className="font-semibold">{item.label}</div>
                      <div className="text-sm mt-1">{item.aiInsight}</div>
                      <div className="text-xs text-blue-600 mt-2 font-medium">
                        {item.recommendedAction}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>

          {/* Selected Range Details */}
          {selectedRange && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                {(() => {
                  const rangeData = chartData.find(item => item.range === selectedRange)
                  if (!rangeData) return null
                  
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: rangeData.color }}
                        ></div>
                        <h4 className="font-semibold text-blue-900">{rangeData.label}</h4>
                        <Badge variant="outline">{rangeData.count} candidates</Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-blue-800 mb-2">AI Insight</h5>
                          <p className="text-sm text-blue-700">{rangeData.aiInsight}</p>
                        </div>
                        
                        <div>
                          <h5 className="font-medium text-blue-800 mb-2">Recommended Action</h5>
                          <p className="text-sm text-blue-700">{rangeData.recommendedAction}</p>
                        </div>
                      </div>
                      
                      {rangeData.candidates.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-blue-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-800">
                              {rangeData.candidates.length} candidate{rangeData.candidates.length !== 1 ? 's' : ''} in this range
                            </span>
                            <Button variant="outline" size="sm">
                              <Eye className="h-3 w-3 mr-1" />
                              View Candidates
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          )}

          {/* Statistical Analysis */}
          {showStats && (
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-base">Statistical Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-lg font-bold text-gray-900">
                      {data.statistics.mean.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-600">Mean Score</div>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-lg font-bold text-gray-900">
                      {data.statistics.median.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-600">Median Score</div>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-lg font-bold text-gray-900">
                      ±{data.statistics.standardDeviation.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-600">Std Deviation</div>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-lg font-bold text-gray-900">
                      {data.statistics.confidence95[0].toFixed(1)}-{data.statistics.confidence95[1].toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-600">95% Confidence</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                  <div className="text-center p-3 bg-green-50 rounded border border-green-200">
                    <div className="text-lg font-bold text-green-700">
                      {data.quality.highConfidencePercent.toFixed(1)}%
                    </div>
                    <div className="text-xs text-green-600">High Confidence</div>
                  </div>
                  
                  <div className="text-center p-3 bg-blue-50 rounded border border-blue-200">
                    <div className="text-lg font-bold text-blue-700">
                      {data.quality.evidenceStrength.toFixed(0)}/100
                    </div>
                    <div className="text-xs text-blue-600">Evidence Strength</div>
                  </div>
                  
                  <div className="text-center p-3 bg-purple-50 rounded border border-purple-200">
                    <div className="text-lg font-bold text-purple-700">
                      {data.quality.diversityIndex.toFixed(0)}
                    </div>
                    <div className="text-xs text-purple-600">Diversity Index</div>
                  </div>
                </div>

                {/* Distribution Analysis */}
                <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
                  <h5 className="font-medium text-yellow-800 mb-2">Distribution Analysis</h5>
                  <div className="text-sm text-yellow-700 space-y-1">
                    {data.statistics.skewness > 0.5 && (
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3 w-3" />
                        <span>Right-skewed distribution: More candidates in lower score ranges</span>
                      </div>
                    )}
                    {data.statistics.skewness < -0.5 && (
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3 w-3 rotate-180" />
                        <span>Left-skewed distribution: More candidates in higher score ranges</span>
                      </div>
                    )}
                    {Math.abs(data.statistics.skewness) <= 0.5 && (
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        <span>Well-balanced distribution across score ranges</span>
                      </div>
                    )}
                    
                    {data.quality.biasScore < 50 && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Potential bias detected - review evaluation criteria</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Utility functions
function getScoreColor(range: string): string {
  const colorMap: { [key: string]: string } = {
    "95-100": "#10b981", // Green - Exceptional
    "85-94": "#3b82f6",  // Blue - Excellent
    "70-84": "#f59e0b",  // Amber - Good
    "55-69": "#f97316",  // Orange - Below threshold
    "0-54": "#ef4444"    // Red - Not qualified
  }
  
  return colorMap[range] || "#6b7280"
}

function findRangeForScore(score: number, chartData: any[]): string {
  for (const item of chartData) {
    const [min, max] = item.range.split('-').map(Number)
    if (score >= min && score <= max) {
      return item.range
    }
  }
  
  // Default to the range that contains the score
  if (score >= 95) return "95-100"
  if (score >= 85) return "85-94"
  if (score >= 70) return "70-84"
  if (score >= 55) return "55-69"
  return "0-54"
}