/**
 * Advanced Visualization Data API
 * Provides optimized data structures for charts and interactive visualizations
 */

import { NextRequest, NextResponse } from 'next/server'
import { analyticsEngine } from '@/lib/analytics/analytics-engine'

interface ChartDataRequest {
  chartType: 'scoreDistribution' | 'skillsRadar' | 'trendsLine' | 'candidateComparison' | 'bonusImpact'
  timeframe?: 'all' | '30d' | '90d' | '1y'
  aggregation?: 'daily' | 'weekly' | 'monthly'
  filters?: {
    scoreRange?: [number, number]
    confidenceLevel?: string[]
    roles?: string[]
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { evaluationId: string } }
) {
  try {
    const { evaluationId } = params
    const { searchParams } = new URL(request.url)
    
    const chartType = searchParams.get('chartType') as ChartDataRequest['chartType']
    const timeframe = searchParams.get('timeframe') as ChartDataRequest['timeframe'] || 'all'
    const aggregation = searchParams.get('aggregation') as ChartDataRequest['aggregation'] || 'daily'
    
    if (!evaluationId) {
      return NextResponse.json(
        { error: 'Evaluation ID is required' },
        { status: 400 }
      )
    }
    
    if (!chartType) {
      return NextResponse.json(
        { error: 'Chart type is required' },
        { status: 400 }
      )
    }
    
    console.log(`Generating ${chartType} visualization data for evaluation: ${evaluationId}`)
    
    // Generate analytics data
    const analytics = await analyticsEngine.generateAnalytics(evaluationId)
    
    // Generate chart-specific data
    const chartData = await generateChartData(analytics, chartType, { timeframe, aggregation })
    
    return NextResponse.json({
      success: true,
      data: chartData,
      metadata: {
        chartType,
        evaluationId,
        timeframe,
        aggregation,
        generatedAt: new Date().toISOString(),
        dataPoints: getDataPointCount(chartData)
      }
    })
    
  } catch (error) {
    console.error('Visualization data error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate visualization data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { evaluationId: string } }
) {
  try {
    const { evaluationId } = params
    const body: ChartDataRequest = await request.json()
    
    const { chartType, timeframe = 'all', aggregation = 'daily', filters } = body
    
    if (!evaluationId) {
      return NextResponse.json(
        { error: 'Evaluation ID is required' },
        { status: 400 }
      )
    }
    
    if (!chartType) {
      return NextResponse.json(
        { error: 'Chart type is required' },
        { status: 400 }
      )
    }
    
    console.log(`Generating custom ${chartType} visualization with filters for evaluation: ${evaluationId}`)
    
    // Generate analytics data
    const analytics = await analyticsEngine.generateAnalytics(evaluationId)
    
    // Apply filters if provided
    const filteredAnalytics = applyFilters(analytics, filters)
    
    // Generate chart-specific data
    const chartData = await generateChartData(filteredAnalytics, chartType, { timeframe, aggregation })
    
    return NextResponse.json({
      success: true,
      data: chartData,
      metadata: {
        chartType,
        evaluationId,
        timeframe,
        aggregation,
        filters,
        generatedAt: new Date().toISOString(),
        dataPoints: getDataPointCount(chartData)
      }
    })
    
  } catch (error) {
    console.error('Custom visualization data error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate custom visualization data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function generateChartData(analytics: any, chartType: string, options: any) {
  switch (chartType) {
    case 'scoreDistribution':
      return generateScoreDistributionData(analytics)
    
    case 'skillsRadar':
      return generateSkillsRadarData(analytics)
    
    case 'trendsLine':
      return generateTrendsLineData(analytics, options)
    
    case 'candidateComparison':
      return generateCandidateComparisonData(analytics)
    
    case 'bonusImpact':
      return generateBonusImpactData(analytics)
    
    default:
      throw new Error(`Unsupported chart type: ${chartType}`)
  }
}

function generateScoreDistributionData(analytics: any) {
  const distribution = analytics.metrics.scoreDistribution
  
  // Histogram data
  const histogramData = Object.entries(distribution.ranges).map(([range, data]: [string, any]) => ({
    range,
    count: data.count,
    percentage: data.percentage,
    label: data.label,
    color: getScoreColor(range),
    candidates: data.candidates,
    aiInsight: data.aiInsight,
    recommendedAction: data.recommendedAction
  }))
  
  // Statistical overlay data
  const statistics = {
    mean: distribution.statistics.mean,
    median: distribution.statistics.median,
    standardDeviation: distribution.statistics.standardDeviation,
    confidence95: distribution.statistics.confidence95,
    skewness: distribution.statistics.skewness,
    kurtosis: distribution.statistics.kurtosis
  }
  
  // Quality indicators
  const qualityMetrics = {
    highConfidencePercent: distribution.quality.highConfidencePercent,
    evidenceStrength: distribution.quality.evidenceStrength,
    biasScore: distribution.quality.biasScore,
    diversityIndex: distribution.quality.diversityIndex
  }
  
  return {
    type: 'scoreDistribution',
    histogram: histogramData,
    statistics,
    qualityMetrics,
    
    // Chart configuration
    chartConfig: {
      type: 'histogram',
      xAxis: { title: 'Score Range', type: 'categorical' },
      yAxis: { title: 'Number of Candidates', type: 'linear' },
      colors: histogramData.map(d => d.color),
      annotations: [
        {
          type: 'line',
          value: statistics.mean,
          label: `Mean: ${statistics.mean.toFixed(1)}`,
          color: '#2563eb'
        },
        {
          type: 'line', 
          value: statistics.median,
          label: `Median: ${statistics.median.toFixed(1)}`,
          color: '#dc2626'
        }
      ]
    }
  }
}

function generateSkillsRadarData(analytics: any) {
  const skillsAnalysis = analytics.skillsAnalysis
  
  // Radar chart data
  const radarData = skillsAnalysis.skillPerformance.map((skill: any) => ({
    skill: skill.skill,
    foundRate: skill.foundRate,
    confidence: skill.averageConfidence * 10, // Convert to 0-100 scale
    marketDemand: getMarketDemandScore(skill.marketDemand),
    required: skill.required,
    category: getSkillCategory(skill.skill),
    color: getSkillColor(skill.category)
  }))
  
  // Skill gaps overlay
  const skillGaps = skillsAnalysis.gaps.map((gap: any) => ({
    skill: gap.skill,
    severity: gap.severity,
    impact: gap.impact,
    recommendation: gap.recommendation
  }))
  
  // Emerging skills
  const emergingSkills = skillsAnalysis.emergingSkills.map((skill: any) => ({
    skill: skill.skill,
    frequency: skill.frequency,
    marketValue: skill.marketValue,
    futureRelevance: skill.futureRelevance
  }))
  
  return {
    type: 'skillsRadar',
    radarData,
    skillGaps,
    emergingSkills,
    
    // Chart configuration
    chartConfig: {
      type: 'radar',
      axes: [
        { name: 'Found Rate', max: 100, min: 0 },
        { name: 'Confidence', max: 100, min: 0 },
        { name: 'Market Demand', max: 100, min: 0 }
      ],
      colors: {
        required: '#dc2626',
        optional: '#2563eb',
        emerging: '#059669'
      }
    }
  }
}

function generateTrendsLineData(analytics: any, options: any) {
  const trends = analytics.trends
  
  // Generate trend data points (in production, would be historical data)
  const trendData = [
    {
      date: '2024-01-01',
      averageScore: 78.5,
      qualifiedCount: 45,
      qualityPipeline: 85
    },
    {
      date: '2024-02-01',
      averageScore: 81.2,
      qualifiedCount: 52,
      qualityPipeline: 88
    },
    {
      date: '2024-03-01',
      averageScore: trends.averageScore,
      qualifiedCount: analytics.metrics.qualifiedCount,
      qualityPipeline: trends.qualityPipeline
    }
  ]
  
  // Prediction data
  const predictions = analytics.predictions
  const predictedData = [
    {
      date: '2024-04-01',
      predictedScore: trends.averageScore + 2.5,
      confidenceInterval: [trends.averageScore, trends.averageScore + 5],
      hiringSuccess: predictions.hiringSuccess.probability
    }
  ]
  
  return {
    type: 'trendsLine',
    historical: trendData,
    predictions: predictedData,
    
    // Chart configuration
    chartConfig: {
      type: 'line',
      xAxis: { title: 'Time Period', type: 'time' },
      yAxis: { title: 'Score / Percentage', type: 'linear' },
      series: [
        { name: 'Average Score', color: '#2563eb' },
        { name: 'Quality Pipeline', color: '#059669' },
        { name: 'Predicted Score', color: '#dc2626', style: 'dashed' }
      ]
    }
  }
}

function generateCandidateComparisonData(analytics: any) {
  // Generate comparison data for top candidates
  // In production, would fetch actual candidate data
  
  const topCandidates = [
    {
      id: 'candidate-1',
      name: 'Sarah Chen',
      finalScore: 95,
      baseScore: 89,
      bonusPoints: 8,
      penaltyPoints: 2,
      confidenceLevel: 'HIGH',
      successPrediction: 94,
      skills: ['React', 'TypeScript', 'AWS', 'Leadership'],
      strengths: ['System Architecture', 'Team Leadership', 'Innovation'],
      concerns: ['Job Hopping']
    },
    {
      id: 'candidate-2', 
      name: 'Mike Rodriguez',
      finalScore: 88,
      baseScore: 85,
      bonusPoints: 3,
      penaltyPoints: 0,
      confidenceLevel: 'HIGH',
      successPrediction: 87,
      skills: ['Python', 'Machine Learning', 'SQL', 'Analytics'],
      strengths: ['Technical Depth', 'Problem Solving', 'Growth Mindset'],
      concerns: []
    },
    {
      id: 'candidate-3',
      name: 'Alex Kim',
      finalScore: 85,
      baseScore: 82,
      bonusPoints: 6,
      penaltyPoints: 3,
      confidenceLevel: 'MEDIUM',
      successPrediction: 79,
      skills: ['Java', 'Spring', 'Microservices', 'DevOps'],
      strengths: ['Experience', 'Reliability', 'Mentoring'],
      concerns: ['Modern Stack Gap', 'Adaptability']
    }
  ]
  
  return {
    type: 'candidateComparison',
    candidates: topCandidates,
    
    // Comparison matrices
    scoreComparison: topCandidates.map(c => ({
      name: c.name,
      scores: {
        final: c.finalScore,
        base: c.baseScore,
        bonus: c.bonusPoints,
        penalty: c.penaltyPoints,
        success: c.successPrediction
      }
    })),
    
    skillsComparison: topCandidates.map(c => ({
      name: c.name,
      skills: c.skills,
      skillCount: c.skills.length
    })),
    
    // Chart configuration
    chartConfig: {
      type: 'comparison',
      formats: ['radar', 'bar', 'parallel'],
      metrics: ['Final Score', 'Base Score', 'Bonus Points', 'Success Prediction'],
      colors: ['#2563eb', '#059669', '#dc2626']
    }
  }
}

function generateBonusImpactData(analytics: any) {
  const bonusData = analytics.bonusPenaltyImpact
  
  if (!bonusData) {
    return {
      type: 'bonusImpact',
      configured: false,
      message: 'No bonus/penalty configuration detected'
    }
  }
  
  // Impact analysis data
  const impactData = {
    bonuses: {
      averagePoints: bonusData.impact.averageBonusPoints,
      candidatesAffected: bonusData.impact.candidatesImproved,
      modules: bonusData.activeModules.bonuses
    },
    penalties: {
      averagePoints: bonusData.impact.averagePenaltyPoints,
      candidatesAffected: bonusData.impact.candidatesDeclined,
      modules: bonusData.activeModules.penalties
    },
    netEffect: bonusData.impact.netEffect,
    effectiveness: bonusData.effectiveness
  }
  
  // Module performance breakdown
  const modulePerformance = bonusData.activeModules.bonuses.map((module: string) => ({
    module,
    type: 'bonus',
    impact: Math.random() * 5 + 1, // Would be calculated from actual data
    candidates: Math.floor(Math.random() * 20) + 5,
    effectiveness: Math.random() * 40 + 60
  })).concat(
    bonusData.activeModules.penalties.map((module: string) => ({
      module,
      type: 'penalty',
      impact: Math.random() * -3 - 0.5,
      candidates: Math.floor(Math.random() * 15) + 3,
      effectiveness: Math.random() * 30 + 70
    }))
  )
  
  return {
    type: 'bonusImpact',
    configured: true,
    impactData,
    modulePerformance,
    
    // Chart configuration
    chartConfig: {
      type: 'impact',
      formats: ['waterfall', 'sunburst', 'treemap'],
      colors: {
        bonus: '#059669',
        penalty: '#dc2626',
        net: '#2563eb'
      }
    }
  }
}

function applyFilters(analytics: any, filters?: any) {
  if (!filters) return analytics
  
  // In production, would apply actual filtering logic
  // For now, returning original analytics
  return analytics
}

function getDataPointCount(chartData: any): number {
  if (chartData.histogram) return chartData.histogram.length
  if (chartData.radarData) return chartData.radarData.length
  if (chartData.historical) return chartData.historical.length
  if (chartData.candidates) return chartData.candidates.length
  if (chartData.modulePerformance) return chartData.modulePerformance.length
  
  return 0
}

// Utility functions for chart styling and data processing
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

function getMarketDemandScore(demand: string): number {
  const demandMap: { [key: string]: number } = {
    "VERY_HIGH": 90,
    "HIGH": 75,
    "MEDIUM": 50,
    "LOW": 25
  }
  
  return demandMap[demand] || 50
}

function getSkillCategory(skill: string): string {
  const skillLower = skill.toLowerCase()
  
  if (['react', 'vue', 'angular', 'javascript', 'typescript', 'html', 'css'].some(s => skillLower.includes(s))) {
    return 'Frontend'
  }
  
  if (['node', 'python', 'java', 'c#', 'go', 'rust', 'php'].some(s => skillLower.includes(s))) {
    return 'Backend'
  }
  
  if (['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'devops'].some(s => skillLower.includes(s))) {
    return 'Cloud/DevOps'
  }
  
  if (['sql', 'mongodb', 'postgresql', 'redis', 'database'].some(s => skillLower.includes(s))) {
    return 'Database'
  }
  
  return 'Other'
}

function getSkillColor(category: string): string {
  const colorMap: { [key: string]: string } = {
    'Frontend': '#3b82f6',
    'Backend': '#059669',
    'Cloud/DevOps': '#dc2626',
    'Database': '#f59e0b',
    'Other': '#6b7280'
  }
  
  return colorMap[category] || '#6b7280'
}