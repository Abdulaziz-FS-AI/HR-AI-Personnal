"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine } from 'recharts'
import { TrendingUp, TrendingDown, Activity, Clock } from "lucide-react"

interface TrendsData {
  weekOverWeekChange: {
    evaluated: number
    averageScore: number
    qualityPipeline: number
  }
  qualityPipeline: number
  marketBenchmark: number
}

interface TrendsLineChartProps {
  data: TrendsData
  evaluationId: string
}

export function TrendsLineChart({ data, evaluationId }: TrendsLineChartProps) {
  // Generate historical trend data (in production, this would come from actual historical data)
  const trendData = [
    {
      period: "Jan 2024",
      avgScore: 78.5,
      qualityPipeline: 85,
      marketBenchmark: 72,
      timeToHire: 15,
      volume: 42
    },
    {
      period: "Feb 2024", 
      avgScore: 81.2,
      qualityPipeline: 88,
      marketBenchmark: 74,
      timeToHire: 12,
      volume: 56
    },
    {
      period: "Mar 2024",
      avgScore: 85.7,
      qualityPipeline: data.qualityPipeline,
      marketBenchmark: data.marketBenchmark,
      timeToHire: 8,
      volume: 73
    },
    {
      period: "Apr 2024 (Projected)",
      avgScore: 87.2,
      qualityPipeline: data.qualityPipeline + 2,
      marketBenchmark: data.marketBenchmark + 1,
      timeToHire: 7,
      volume: 85,
      projected: true
    }
  ]

  const formatTooltip = (value: any, name: string) => {
    if (name === 'avgScore' || name === 'qualityPipeline' || name === 'marketBenchmark') {
      return [`${value.toFixed(1)}%`, formatLabel(name)]
    }
    if (name === 'timeToHire') {
      return [`${value} days`, formatLabel(name)]
    }
    return [value, formatLabel(name)]
  }

  const formatLabel = (name: string) => {
    const labelMap: { [key: string]: string } = {
      avgScore: 'Average Score',
      qualityPipeline: 'Quality Pipeline',
      marketBenchmark: 'Market Benchmark',
      timeToHire: 'Time to Hire',
      volume: 'Candidates Volume'
    }
    return labelMap[name] || name
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Performance Trends & Predictions
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Historical performance with AI-powered forecasting
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Last 3 months
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-6">
          {/* Trend Metrics Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-center gap-2 mb-2">
                {data.weekOverWeekChange.averageScore >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm font-medium text-green-800">Average Score</span>
              </div>
              <div className="text-2xl font-bold text-green-900">
                {data.weekOverWeekChange.averageScore >= 0 ? '+' : ''}{data.weekOverWeekChange.averageScore.toFixed(1)}%
              </div>
              <div className="text-xs text-green-700">Week over week</div>
            </div>
            
            <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-center gap-2 mb-2">
                {data.weekOverWeekChange.qualityPipeline >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm font-medium text-blue-800">Quality Pipeline</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {data.qualityPipeline.toFixed(0)}%
              </div>
              <div className="text-xs text-blue-700">Current quality score</div>
            </div>
            
            <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">Market Position</span>
              </div>
              <div className="text-2xl font-bold text-purple-900">
                +{(data.qualityPipeline - data.marketBenchmark).toFixed(0)}%
              </div>
              <div className="text-xs text-purple-700">Above market benchmark</div>
            </div>
          </div>

          {/* Line Chart */}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="period" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={formatTooltip}
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{ 
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                
                {/* Market Benchmark Reference Line */}
                <ReferenceLine 
                  y={data.marketBenchmark} 
                  stroke="#9ca3af" 
                  strokeDasharray="8 8"
                  label={{ value: `Market: ${data.marketBenchmark}%`, position: "left" }}
                />
                
                {/* Average Score Line */}
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ fill: '#2563eb', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, stroke: '#2563eb', strokeWidth: 2 }}
                />
                
                {/* Quality Pipeline Line */}
                <Line
                  type="monotone"
                  dataKey="qualityPipeline"
                  stroke="#059669"
                  strokeWidth={3}
                  dot={{ fill: '#059669', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, stroke: '#059669', strokeWidth: 2 }}
                />
                
                {/* Projected Line (dashed) */}
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  stroke="#2563eb"
                  strokeWidth={2}
                  strokeDasharray="8 8"
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-blue-600"></div>
              <span>Average Score</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-green-600"></div>
              <span>Quality Pipeline</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-gray-400 border-dashed border-b"></div>
              <span>Market Benchmark</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-blue-400 border-dashed border-b"></div>
              <span>Projected</span>
            </div>
          </div>

          {/* Secondary Metrics Area Chart */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Secondary Metrics</h4>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Time to Hire Trend */}
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-3">Time to Hire (Days)</h5>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="timeToHireGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value) => [`${value} days`, 'Time to Hire']} />
                      <Area
                        type="monotone"
                        dataKey="timeToHire"
                        stroke="#f59e0b"
                        fillOpacity={1}
                        fill="url(#timeToHireGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-xs text-gray-600 mt-2">
                  47% improvement in hiring speed
                </div>
              </div>

              {/* Candidate Volume Trend */}
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-3">Candidate Volume</h5>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value) => [value, 'Candidates']} />
                      <Area
                        type="monotone"
                        dataKey="volume"
                        stroke="#8b5cf6"
                        fillOpacity={1}
                        fill="url(#volumeGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-xs text-gray-600 mt-2">
                  73% increase in qualified candidates
                </div>
              </div>
            </div>
          </div>

          {/* AI Trend Insights */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">AI Trend Analysis</h4>
                <div className="space-y-2 text-sm text-blue-800">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-3 w-3" />
                    <span>Strong upward trajectory in candidate quality (+15% over 3 months)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>Time-to-hire improving significantly (-47% reduction)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-3 w-3" />
                    <span>Performance consistently above market benchmark (+{(data.qualityPipeline - data.marketBenchmark).toFixed(0)}%)</span>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-xs text-blue-700 font-medium">
                    🎯 Prediction: Current trends suggest continued improvement with 87% average scores projected for next month
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}