"use client"

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { 
  Play, 
  Search, 
  Filter,
  Calendar,
  Users,
  FileText,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Eye,
  Download,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'

interface EvaluationSession {
  id: string
  name: string
  description: string | null
  roleId: string
  status: 'draft' | 'ready' | 'processing' | 'completed' | 'failed'
  totalFiles: number
  processedFiles: number
  failedFiles: number
  averageScore: number | null
  highestScore: number | null
  lowestScore: number | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export default function EvaluationsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('recent')
  const [evaluations, setEvaluations] = useState<EvaluationSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session?.user?.id) {
      fetchEvaluations()
    }
  }, [session])

  const fetchEvaluations = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/evaluations')
      
      if (response.ok) {
        const data = await response.json()
        setEvaluations(data.evaluations || [])
      } else {
        throw new Error('Failed to fetch evaluations')
      }
    } catch (error) {
      console.error('Error fetching evaluations:', error)
      toast({
        title: "Error",
        description: "Failed to load evaluations. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchEvaluations()
  }

  const getStatusBadge = (status: EvaluationSession['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
      case 'ready':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Ready</Badge>
      case 'draft':
        return <Badge className="bg-gray-100 text-gray-800"><FileText className="w-3 h-3 mr-1" />Draft</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const filteredEvaluations = evaluations.filter(evaluation => {
    const matchesSearch = evaluation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (evaluation.description && evaluation.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesStatus = statusFilter === 'all' || evaluation.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Sort evaluations
  const sortedEvaluations = [...filteredEvaluations].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case 'name':
        return a.name.localeCompare(b.name)
      case 'status':
        return a.status.localeCompare(b.status)
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
  })

  const stats = {
    total: evaluations.length,
    completed: evaluations.filter(e => e.status === 'completed').length,
    processing: evaluations.filter(e => e.status === 'processing').length,
    failed: evaluations.filter(e => e.status === 'failed').length
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Evaluations</h1>
          <p className="text-gray-600 mt-1">
            Manage and monitor your resume evaluation sessions
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button onClick={handleRefresh} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/evaluations/create">
              <Plus className="w-4 h-4 mr-2" />
              New Evaluation
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Processing</p>
                <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
              </div>
              <Loader2 className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search evaluations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Evaluations List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading evaluations...</h3>
              <p className="text-gray-600">Please wait while we fetch your evaluation sessions.</p>
            </CardContent>
          </Card>
        ) : sortedEvaluations.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No evaluations found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'No evaluations match your current filters.' 
                  : 'Get started by creating your first evaluation session.'}
              </p>
              <Button asChild>
                <Link href="/evaluations/create">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Evaluation
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          sortedEvaluations.map((evaluation) => (
            <Card key={evaluation.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {evaluation.name}
                      </h3>
                      {getStatusBadge(evaluation.status)}
                    </div>
                    {evaluation.description && (
                      <p className="text-sm text-gray-600 mt-1">{evaluation.description}</p>
                    )}
                    
                    <div className="flex items-center space-x-6 mt-3 text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(evaluation.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        {evaluation.processedFiles}/{evaluation.totalFiles} files
                      </div>
                      {evaluation.averageScore && (
                        <div className="flex items-center">
                          <BarChart3 className="w-4 h-4 mr-1" />
                          {Math.round(evaluation.averageScore)}% avg score
                        </div>
                      )}
                      {evaluation.failedFiles > 0 && (
                        <div className="flex items-center">
                          <XCircle className="w-4 h-4 mr-1 text-red-500" />
                          {evaluation.failedFiles} failed
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {evaluation.status === 'draft' && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/evaluations/${evaluation.id}/upload`}>
                          <FileText className="w-4 h-4 mr-2" />
                          Upload Files
                        </Link>
                      </Button>
                    )}
                    {evaluation.status === 'processing' && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/evaluations/${evaluation.id}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Progress
                        </Link>
                      </Button>
                    )}
                    {evaluation.status === 'completed' && (
                      <>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/evaluations/${evaluation.id}/results`}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Results
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/api/evaluations/${evaluation.id}/export?format=csv`}>
                            <Download className="w-4 h-4 mr-2" />
                            Export
                          </Link>
                        </Button>
                      </>
                    )}
                    {evaluation.status === 'ready' && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/evaluations/${evaluation.id}`}>
                          <Play className="w-4 h-4 mr-2" />
                          Start Processing
                        </Link>
                      </Button>
                    )}
                    {evaluation.status === 'failed' && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/evaluations/${evaluation.id}`}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Retry
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
                
                {evaluation.status === 'processing' && evaluation.totalFiles > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{evaluation.processedFiles} / {evaluation.totalFiles} files</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${(evaluation.processedFiles / evaluation.totalFiles) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Getting Started Help */}
      {evaluations.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Getting Started with Evaluations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-blue-600" />
                  1. Prepare Job Role
                </h4>
                <p className="text-gray-600">
                  Create a job role with specific skills and requirements. 
                  Define what you&apos;re looking for in candidates.
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center">
                  <Users className="w-4 h-4 mr-2 text-green-600" />
                  2. Upload Resumes
                </h4>
                <p className="text-gray-600">
                  Upload candidate resumes to your Resume Library. 
                  You can process up to 150 resumes per evaluation.
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center">
                  <BarChart3 className="w-4 h-4 mr-2 text-purple-600" />
                  3. Start Evaluation
                </h4>
                <p className="text-gray-600">
                  Launch an AI-powered evaluation to analyze and rank 
                  candidates against your job requirements.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}