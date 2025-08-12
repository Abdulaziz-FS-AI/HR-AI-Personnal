"use client"

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { 
  ArrowLeft,
  Download,
  Filter,
  Search,
  Star,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  Loader2
} from 'lucide-react'
import Link from 'next/link'

interface CandidateResult {
  id: string
  fileName: string
  overallScore: number
  recommendation: string
  summary: string
  strengths: string[]
  weaknesses: string[]
  redFlags: string[]
  skillsAnalysis: any
  questionsAnalysis: any
  suggestedInterviewQuestions: string[]
}

interface ResultsStats {
  total: number
  averageScore: number
  highScore: number
  lowScore: number
  excellent: number
  good: number
  fair: number
  poor: number
}

export default function EvaluationResultsPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()
  
  const evaluationId = params.id as string
  const [results, setResults] = useState<CandidateResult[]>([])
  const [filteredResults, setFilteredResults] = useState<CandidateResult[]>([])
  const [stats, setStats] = useState<ResultsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [scoreFilter, setScoreFilter] = useState('all')
  const [sortBy, setSortBy] = useState('score')
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null)
  
  useEffect(() => {
    if (evaluationId && session?.user?.id) {
      fetchResults()
    }
  }, [evaluationId, session])
  
  useEffect(() => {
    filterAndSortResults()
  }, [results, searchTerm, scoreFilter, sortBy])
  
  const fetchResults = async () => {
    try {
      const response = await fetch(`/api/evaluations/${evaluationId}/results`)
      if (response.ok) {
        const data = await response.json()
        setResults(data.results)
        setStats(data.stats)
      } else {
        toast({
          title: "Error",
          description: "Failed to load results",
          variant: "destructive"
        })
        router.push(`/evaluations/${evaluationId}`)
      }
    } catch (error) {
      console.error('Error fetching results:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const filterAndSortResults = () => {
    let filtered = [...results]
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(r => 
        r.fileName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    // Apply score filter
    switch (scoreFilter) {
      case 'excellent':
        filtered = filtered.filter(r => r.overallScore >= 80)
        break
      case 'good':
        filtered = filtered.filter(r => r.overallScore >= 60 && r.overallScore < 80)
        break
      case 'fair':
        filtered = filtered.filter(r => r.overallScore >= 40 && r.overallScore < 60)
        break
      case 'poor':
        filtered = filtered.filter(r => r.overallScore < 40)
        break
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return b.overallScore - a.overallScore
        case 'name':
          return a.fileName.localeCompare(b.fileName)
        default:
          return b.overallScore - a.overallScore
      }
    })
    
    setFilteredResults(filtered)
  }
  
  const getScoreBadge = (score: number) => {
    if (score >= 80) {
      return <Badge className="bg-green-100 text-green-800">Excellent</Badge>
    } else if (score >= 60) {
      return <Badge className="bg-blue-100 text-blue-800">Good</Badge>
    } else if (score >= 40) {
      return <Badge className="bg-yellow-100 text-yellow-800">Fair</Badge>
    } else {
      return <Badge className="bg-red-100 text-red-800">Poor</Badge>
    }
  }
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-blue-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }
  
  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const response = await fetch(`/api/evaluations/${evaluationId}/export?format=${format}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `evaluation-results.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast({
          title: "Export Successful",
          description: `Results exported as ${format.toUpperCase()}`,
        })
      }
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: "Export Failed",
        description: "Failed to export results",
        variant: "destructive"
      })
    }
  }
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/evaluations/${evaluationId}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Evaluation
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Evaluation Results</h1>
            <p className="text-gray-600 mt-1">
              AI analysis results for candidate screening
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('csv')}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport('json')}>
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>
      
      {/* Statistics Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Candidates</p>
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
                  <p className="text-sm font-medium text-gray-600">Average Score</p>
                  <p className="text-2xl font-bold">{Math.round(stats.averageScore)}%</p>
                </div>
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Top Score</p>
                  <p className="text-2xl font-bold text-green-600">{Math.round(stats.highScore)}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600" />
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
                <Star className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search candidates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={scoreFilter} onValueChange={setScoreFilter}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scores</SelectItem>
                <SelectItem value="excellent">Excellent (80+)</SelectItem>
                <SelectItem value="good">Good (60-79)</SelectItem>
                <SelectItem value="fair">Fair (40-59)</SelectItem>
                <SelectItem value="poor">Poor (&lt;40)</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Score (High to Low)</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Results List */}
      <div className="space-y-4">
        {filteredResults.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
              <p className="text-gray-600">
                {searchTerm || scoreFilter !== 'all' 
                  ? 'No candidates match your filters. Try adjusting your search criteria.'
                  : 'No results available for this evaluation.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredResults.map((candidate) => (
            <Card key={candidate.id} className="overflow-hidden">
              <CardContent className="p-6">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedCandidate(
                    expandedCandidate === candidate.id ? null : candidate.id
                  )}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`text-3xl font-bold ${getScoreColor(candidate.overallScore)}`}>
                      {Math.round(candidate.overallScore)}%
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{candidate.fileName}</h3>
                      <p className="text-sm text-gray-600">{candidate.recommendation}</p>
                    </div>
                    {getScoreBadge(candidate.overallScore)}
                  </div>
                  <Button variant="ghost" size="sm">
                    {expandedCandidate === candidate.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                
                {expandedCandidate === candidate.id && (
                  <div className="mt-6 pt-6 border-t">
                    <Tabs defaultValue="summary" className="w-full">
                      <TabsList>
                        <TabsTrigger value="summary">Summary</TabsTrigger>
                        <TabsTrigger value="strengths">Strengths</TabsTrigger>
                        <TabsTrigger value="weaknesses">Weaknesses</TabsTrigger>
                        <TabsTrigger value="questions">Interview Questions</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="summary" className="mt-4">
                        <p className="text-gray-700">{candidate.summary}</p>
                        {candidate.redFlags && candidate.redFlags.length > 0 && (
                          <div className="mt-4">
                            <h4 className="font-semibold text-red-600 mb-2">⚠️ Red Flags</h4>
                            <ul className="list-disc list-inside space-y-1">
                              {candidate.redFlags.map((flag, idx) => (
                                <li key={idx} className="text-sm text-red-600">{flag}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="strengths" className="mt-4">
                        <ul className="space-y-2">
                          {candidate.strengths.map((strength, idx) => (
                            <li key={idx} className="flex items-start">
                              <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
                              <span className="text-gray-700">{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </TabsContent>
                      
                      <TabsContent value="weaknesses" className="mt-4">
                        <ul className="space-y-2">
                          {candidate.weaknesses.map((weakness, idx) => (
                            <li key={idx} className="flex items-start">
                              <XCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                              <span className="text-gray-700">{weakness}</span>
                            </li>
                          ))}
                        </ul>
                      </TabsContent>
                      
                      <TabsContent value="questions" className="mt-4">
                        <ul className="space-y-2">
                          {candidate.suggestedInterviewQuestions.map((question, idx) => (
                            <li key={idx} className="flex items-start">
                              <span className="text-blue-600 mr-2">{idx + 1}.</span>
                              <span className="text-gray-700">{question}</span>
                            </li>
                          ))}
                        </ul>
                      </TabsContent>
                    </Tabs>
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