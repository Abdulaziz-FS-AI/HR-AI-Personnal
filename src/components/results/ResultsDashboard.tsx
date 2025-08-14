"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart3, 
  Users, 
  Trophy, 
  AlertTriangle, 
  FileText, 
  Download,
  Star,
  Clock,
  Target,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CompleteAnalysisResult {
  analysisId: string
  fileId: string
  roleId: string
  userId: string
  overallScore: number
  summary?: string
  recommendations?: string[]
  redFlags?: string[]
  fileName?: string
  fileSize?: number
  uploadedAt?: Date
  roleName?: string
  skillsFoundCount: number
  totalSkillsCount: number
  avgQuestionScore?: number
  analysisCompletedAt: Date
}

interface ResultsDashboardProps {
  roleId: string
  userId: string
}

export function ResultsDashboard({ roleId, userId }: ResultsDashboardProps) {
  const [results, setResults] = useState<CompleteAnalysisResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedResult, setSelectedResult] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score')
  const [filterScore, setFilterScore] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  useEffect(() => {
    loadResults()
  }, [roleId, userId])

  const loadResults = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/results/${roleId}?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        setResults(data.results || [])
      }
    } catch (error) {
      console.error('Failed to load results:', error)
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50'
    if (score >= 40) return 'text-orange-600 bg-orange-50'
    return 'text-red-600 bg-red-50'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Fair'
    return 'Poor'
  }

  const filteredResults = results
    .filter(result => {
      if (filterScore === 'all') return true
      if (filterScore === 'high') return result.overallScore >= 70
      if (filterScore === 'medium') return result.overallScore >= 40 && result.overallScore < 70
      if (filterScore === 'low') return result.overallScore < 40
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'score') {
        return b.overallScore - a.overallScore
      }
      return new Date(b.analysisCompletedAt).getTime() - new Date(a.analysisCompletedAt).getTime()
    })

  const stats = {
    total: results.length,
    excellent: results.filter(r => r.overallScore >= 80).length,
    good: results.filter(r => r.overallScore >= 60 && r.overallScore < 80).length,
    fair: results.filter(r => r.overallScore >= 40 && r.overallScore < 60).length,
    poor: results.filter(r => r.overallScore < 40).length,
    avgScore: results.length > 0 ? Math.round(results.reduce((acc, r) => acc + r.overallScore, 0) / results.length) : 0
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading results...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resume Analysis Results</h1>
          <p className="text-gray-600">Review and analyze candidate performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Results
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Resumes</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Excellent (80+)</p>
                <p className="text-2xl font-bold text-green-600">{stats.excellent}</p>
              </div>
              <Trophy className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Good (60-79)</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.good}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Fair (40-59)</p>
                <p className="text-2xl font-bold text-orange-600">{stats.fair}</p>
              </div>
              <Target className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Score</p>
                <p className="text-2xl font-bold">{stats.avgScore}%</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Sorting */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filter & Sort</CardTitle>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Score:</label>
                <select 
                  value={filterScore} 
                  onChange={(e) => setFilterScore(e.target.value as any)}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="all">All Scores</option>
                  <option value="high">High (70+)</option>
                  <option value="medium">Medium (40-69)</option>
                  <option value="low">Low (&lt;40)</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Sort by:</label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="score">Score</option>
                  <option value="date">Date</option>
                </select>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Results List */}
      <div className="space-y-4">
        {filteredResults.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
              <p className="text-gray-600">
                {results.length === 0 
                  ? "No resumes have been analyzed yet." 
                  : "No results match your current filters."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredResults.map((result) => (
            <Card key={result.analysisId} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <FileText className="w-5 h-5 text-gray-500" />
                      <div>
                        <h3 className="font-medium">{result.fileName || 'Resume'}</h3>
                        <p className="text-sm text-gray-500">
                          Analyzed {new Date(result.analysisCompletedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Score and Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Overall Score</p>
                        <div className="flex items-center space-x-2">
                          <span className={cn(
                            "text-2xl font-bold",
                            result.overallScore >= 80 ? "text-green-600" :
                            result.overallScore >= 60 ? "text-yellow-600" :
                            result.overallScore >= 40 ? "text-orange-600" : "text-red-600"
                          )}>
                            {result.overallScore}%
                          </span>
                          <Badge variant="secondary" className={getScoreColor(result.overallScore)}>
                            {getScoreLabel(result.overallScore)}
                          </Badge>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Skills Match</p>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold">
                            {result.skillsFoundCount}/{result.totalSkillsCount}
                          </span>
                          <Progress 
                            value={result.totalSkillsCount > 0 ? (result.skillsFoundCount / result.totalSkillsCount) * 100 : 0} 
                            className="flex-1 h-2"
                          />
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Question Score</p>
                        <div className="flex items-center space-x-2">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span className="font-semibold">
                            {result.avgQuestionScore ? Math.round(result.avgQuestionScore) : 0}%
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">File Size</p>
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-gray-500" />
                          <span className="text-sm">
                            {result.fileSize ? `${(result.fileSize / 1024 / 1024).toFixed(1)}MB` : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    {result.summary && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-600 mb-1">Summary</p>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {result.summary}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedResult(
                        selectedResult === result.analysisId ? null : result.analysisId
                      )}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {selectedResult === result.analysisId ? 'Hide' : 'View'} Details
                    </Button>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedResult === result.analysisId && (
                  <div className="mt-6 pt-6 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Recommendations */}
                      {result.recommendations && result.recommendations.length > 0 && (
                        <div>
                          <h4 className="font-medium text-green-700 mb-2 flex items-center">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Recommendations
                          </h4>
                          <ul className="space-y-1">
                            {result.recommendations.map((rec, index) => (
                              <li key={index} className="text-sm text-gray-700 flex items-start">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 mr-2 flex-shrink-0"></span>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Red Flags */}
                      {result.redFlags && result.redFlags.length > 0 && (
                        <div>
                          <h4 className="font-medium text-red-700 mb-2 flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Concerns
                          </h4>
                          <ul className="space-y-1">
                            {result.redFlags.map((flag, index) => (
                              <li key={index} className="text-sm text-gray-700 flex items-start">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 mr-2 flex-shrink-0"></span>
                                {flag}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3 mt-6">
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Download Report
                      </Button>
                      <Button variant="outline" size="sm">
                        View Full Analysis
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}