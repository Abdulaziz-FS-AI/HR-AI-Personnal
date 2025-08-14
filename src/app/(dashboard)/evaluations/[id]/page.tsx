"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import {
  ArrowLeft,
  FileText,
  Clock,
  Users,
  Target,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  TrendingUp,
  TrendingDown,
  Star,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface EvaluationSession {
  id: string
  name: string
  roleId: string
  roleTitle: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  totalFiles: number
  processedFiles: number
  failedFiles: number
  averageScore?: number
  topCandidates?: number
  createdAt: string
  completedAt?: string
}

interface EvaluationResult {
  id: string
  fileId: string
  fileName: string
  candidateName: string
  overallScore: number
  skillMatches: Array<{
    skill: string
    found: boolean
    confidence: number
    evidence?: string
  }>
  questionAnswers: Array<{
    question: string
    answer: string
    score: number
  }>
  recommendations: string
  redFlags: string[]
  strengths: string[]
}

export default function EvaluationDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const evaluationId = params.id as string
  
  const [session, setSession] = useState<EvaluationSession | null>(null)
  const [results, setResults] = useState<EvaluationResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())
  const [filterScore, setFilterScore] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [sortBy, setSortBy] = useState<'score' | 'name'>('score')

  useEffect(() => {
    loadEvaluationDetails()
  }, [evaluationId])

  const loadEvaluationDetails = async () => {
    try {
      // Load session details
      const sessionResponse = await fetch(`/api/evaluations/${evaluationId}`)
      if (!sessionResponse.ok) throw new Error('Failed to load evaluation')
      
      const sessionData = await sessionResponse.json()
      // Map backend response to frontend interface
      if (sessionData.data?.session) {
        const mappedSession = {
          ...sessionData.data.session,
          topCandidates: sessionData.data.results?.filter((r: any) => r.overallScore >= 70).length || 0
        }
        setSession(mappedSession)
      }
      setResults(sessionData.data?.results || [])
    } catch (error) {
      console.error('Error loading evaluation:', error)
      toast.error('Failed to load evaluation details')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleExpanded = (resultId: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev)
      if (newSet.has(resultId)) {
        newSet.delete(resultId)
      } else {
        newSet.add(resultId)
      }
      return newSet
    })
  }

  const exportResults = async () => {
    try {
      const response = await fetch(`/api/evaluations/${evaluationId}/export`)
      if (!response.ok) throw new Error('Failed to export results')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `evaluation-${evaluationId}-results.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      toast.success('Results exported successfully')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export results')
    }
  }

  const filteredResults = results.filter(result => {
    if (filterScore === 'all') return true
    if (filterScore === 'high') return result.overallScore >= 70
    if (filterScore === 'medium') return result.overallScore >= 40 && result.overallScore < 70
    if (filterScore === 'low') return result.overallScore < 40
    return true
  })

  const sortedResults = [...filteredResults].sort((a, b) => {
    if (sortBy === 'score') return b.overallScore - a.overallScore
    if (sortBy === 'name') return a.candidateName.localeCompare(b.candidateName)
    return 0
  })

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBadge = (score: number) => {
    if (score >= 70) return <Badge className="bg-green-100 text-green-800">High Match</Badge>
    if (score >= 40) return <Badge className="bg-yellow-100 text-yellow-800">Medium Match</Badge>
    return <Badge className="bg-red-100 text-red-800">Low Match</Badge>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Evaluation not found</p>
            <Button onClick={() => router.push('/evaluations')} className="mt-4">
              Back to Evaluations
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/evaluations')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Evaluations
        </Button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{session.name}</h1>
            <p className="text-gray-600 mt-1">
              {session.roleTitle} • Created {new Date(session.createdAt).toLocaleDateString()}
            </p>
          </div>
          
          <Button onClick={exportResults}>
            <Download className="w-4 h-4 mr-2" />
            Export Results
          </Button>
        </div>
      </div>

      {/* Status Card */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Status</span>
                {session.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-600" />}
                {session.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                {session.status === 'failed' && <XCircle className="w-4 h-4 text-red-600" />}
              </div>
              <Badge variant={
                session.status === 'completed' ? 'default' :
                session.status === 'processing' ? 'secondary' : 'destructive'
              }>
                {session.status}
              </Badge>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 mb-2">Files Processed</p>
              <div className="flex items-baseline">
                <span className="text-2xl font-bold">{session.processedFiles}</span>
                <span className="text-gray-500 ml-1">/ {session.totalFiles}</span>
              </div>
              {session.failedFiles > 0 && (
                <p className="text-xs text-red-600 mt-1">{session.failedFiles} failed</p>
              )}
            </div>
            
            <div>
              <p className="text-sm text-gray-600 mb-2">Average Score</p>
              <div className="flex items-center">
                <span className={`text-2xl font-bold ${getScoreColor(session.averageScore || 0)}`}>
                  {session.averageScore?.toFixed(1) || 0}%
                </span>
                {session.averageScore && session.averageScore >= 50 ? (
                  <TrendingUp className="w-4 h-4 text-green-600 ml-2" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600 ml-2" />
                )}
              </div>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 mb-2">Top Candidates</p>
              <div className="flex items-center">
                <Star className="w-5 h-5 text-yellow-500 mr-1" />
                <span className="text-2xl font-bold">{session.topCandidates || 0}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Score ≥ 70%</p>
            </div>
          </div>
          
          {session.status === 'processing' && (
            <div className="mt-4">
              <Progress 
                value={(session.processedFiles / session.totalFiles) * 100} 
                className="h-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Processing... {Math.round((session.processedFiles / session.totalFiles) * 100)}% complete
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters and Results */}
      {results.length > 0 && (
        <>
          {/* Filter Bar */}
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <label className="text-sm text-gray-600 mr-2">Filter by score:</label>
                    <select
                      value={filterScore}
                      onChange={(e) => setFilterScore(e.target.value as any)}
                      className="px-3 py-1 border rounded"
                    >
                      <option value="all">All ({results.length})</option>
                      <option value="high">High (≥70%)</option>
                      <option value="medium">Medium (40-69%)</option>
                      <option value="low">Low (&lt;40%)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-600 mr-2">Sort by:</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-3 py-1 border rounded"
                    >
                      <option value="score">Score</option>
                      <option value="name">Name</option>
                    </select>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600">
                  Showing {sortedResults.length} results
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Results List */}
          <div className="space-y-4">
            {sortedResults.map((result) => (
              <Card key={result.id} className="overflow-hidden">
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleExpanded(result.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`text-3xl font-bold ${getScoreColor(result.overallScore)}`}>
                        {result.overallScore}%
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{result.candidateName}</h3>
                        <p className="text-sm text-gray-600">{result.fileName}</p>
                      </div>
                      {getScoreBadge(result.overallScore)}
                    </div>
                    
                    {expandedResults.has(result.id) ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </CardHeader>
                
                {expandedResults.has(result.id) && (
                  <CardContent className="border-t">
                    <div className="space-y-6 pt-6">
                      {/* Recommendations */}
                      <div>
                        <h4 className="font-medium mb-2">Recommendations</h4>
                        <p className="text-sm text-gray-700">{result.recommendations}</p>
                      </div>
                      
                      {/* Strengths */}
                      {result.strengths.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 text-green-700">Strengths</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {result.strengths.map((strength, idx) => (
                              <li key={idx} className="text-sm text-gray-700">{strength}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Red Flags */}
                      {result.redFlags.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 text-red-700">Red Flags</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {result.redFlags.map((flag, idx) => (
                              <li key={idx} className="text-sm text-gray-700">{flag}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Skills Analysis */}
                      <div>
                        <h4 className="font-medium mb-2">Skills Analysis</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {result.skillMatches.map((skill, idx) => (
                            <div 
                              key={idx}
                              className={`p-2 rounded text-sm ${
                                skill.found 
                                  ? 'bg-green-50 text-green-700' 
                                  : 'bg-gray-50 text-gray-500'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{skill.skill}</span>
                                {skill.found ? (
                                  <CheckCircle className="w-3 h-3" />
                                ) : (
                                  <XCircle className="w-3 h-3" />
                                )}
                              </div>
                              {skill.confidence > 0 && (
                                <div className="text-xs mt-1">
                                  Confidence: {skill.confidence}%
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* No Results */}
      {session.status === 'completed' && results.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No results available for this evaluation</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}