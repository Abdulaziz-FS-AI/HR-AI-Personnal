"use client"

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { 
  ArrowLeft,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  FileText,
  BarChart3,
  Eye,
  Download,
  RefreshCw,
  Loader2,
  Upload
} from 'lucide-react'
import Link from 'next/link'

interface EvaluationDetails {
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

export default function EvaluationProgressPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()
  
  const evaluationId = params.id as string
  const [evaluation, setEvaluation] = useState<EvaluationDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  
  useEffect(() => {
    if (evaluationId && session?.user?.id) {
      fetchEvaluation()
      
      // Set up polling for processing status
      const interval = setInterval(() => {
        if (evaluation?.status === 'processing') {
          fetchProcessingStatus()
        }
      }, 5000) // Poll every 5 seconds
      
      return () => clearInterval(interval)
    }
  }, [evaluationId, session, evaluation?.status])
  
  const fetchEvaluation = async () => {
    try {
      const response = await fetch(`/api/evaluations?id=${evaluationId}`)
      if (response.ok) {
        const data = await response.json()
        setEvaluation(data.evaluation)
        
        // Calculate progress
        if (data.evaluation.totalFiles > 0) {
          const progress = (data.evaluation.processedFiles / data.evaluation.totalFiles) * 100
          setProcessingProgress(progress)
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to load evaluation",
          variant: "destructive"
        })
        router.push('/evaluations')
      }
    } catch (error) {
      console.error('Error fetching evaluation:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const fetchProcessingStatus = async () => {
    try {
      const response = await fetch(`/api/evaluations/${evaluationId}/process`)
      if (response.ok) {
        const data = await response.json()
        setProcessingProgress(data.progress.percentage)
        
        // Refresh evaluation data if completed
        if (data.status === 'completed' || data.status === 'failed') {
          fetchEvaluation()
        }
      }
    } catch (error) {
      console.error('Error fetching processing status:', error)
    }
  }
  
  const handleStartProcessing = async () => {
    try {
      setRefreshing(true)
      const response = await fetch(`/api/evaluations/${evaluationId}/process`, {
        method: 'POST'
      })
      
      if (response.ok) {
        toast({
          title: "Processing Started",
          description: "AI analysis has begun for your evaluation",
        })
        fetchEvaluation()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to start processing",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error starting processing:', error)
      toast({
        title: "Error",
        description: "Failed to start processing",
        variant: "destructive"
      })
    } finally {
      setRefreshing(false)
    }
  }
  
  const handleRefresh = () => {
    setRefreshing(true)
    fetchEvaluation().finally(() => setRefreshing(false))
  }
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'ready':
        return <Clock className="w-5 h-5 text-yellow-600" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />
    }
  }
  
  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      processing: 'bg-blue-100 text-blue-800',
      failed: 'bg-red-100 text-red-800',
      ready: 'bg-yellow-100 text-yellow-800',
      draft: 'bg-gray-100 text-gray-800'
    }
    
    return (
      <Badge className={variants[status] || variants.draft}>
        <span className="flex items-center gap-1">
          {getStatusIcon(status)}
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </Badge>
    )
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
  
  if (!evaluation) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Evaluation Not Found</h3>
            <p className="text-gray-600 mb-4">
              The evaluation you're looking for doesn't exist or you don't have access.
            </p>
            <Button asChild>
              <Link href="/evaluations">Back to Evaluations</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/evaluations">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{evaluation.name}</h1>
            {evaluation.description && (
              <p className="text-gray-600 mt-1">{evaluation.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(evaluation.status)}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      
      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Files</p>
                <p className="text-2xl font-bold">{evaluation.totalFiles}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Processed</p>
                <p className="text-2xl font-bold text-green-600">{evaluation.processedFiles}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{evaluation.failedFiles}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Score</p>
                <p className="text-2xl font-bold">
                  {evaluation.averageScore ? `${Math.round(evaluation.averageScore)}%` : '-'}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Processing Progress */}
      {evaluation.status === 'processing' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processing in Progress
            </CardTitle>
            <CardDescription>
              AI is analyzing your candidate resumes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Progress</span>
                  <span>{Math.round(processingProgress)}%</span>
                </div>
                <Progress value={processingProgress} className="h-2" />
              </div>
              <p className="text-sm text-gray-600">
                {evaluation.processedFiles} of {evaluation.totalFiles} files processed
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>
            Manage your evaluation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {evaluation.status === 'draft' && (
              <Button asChild>
                <Link href={`/evaluations/${evaluationId}/upload`}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Files
                </Link>
              </Button>
            )}
            
            {evaluation.status === 'ready' && (
              <>
                <Button onClick={handleStartProcessing}>
                  <Play className="w-4 h-4 mr-2" />
                  Start Processing
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/evaluations/${evaluationId}/upload`}>
                    <Upload className="w-4 h-4 mr-2" />
                    Add More Files
                  </Link>
                </Button>
              </>
            )}
            
            {evaluation.status === 'completed' && (
              <>
                <Button asChild>
                  <Link href={`/evaluations/${evaluationId}/results`}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Results
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/evaluations/${evaluationId}/export`}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Results
                  </Link>
                </Button>
              </>
            )}
            
            {evaluation.status === 'failed' && (
              <Button onClick={handleStartProcessing} variant="destructive">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Processing
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Timing Information */}
      {(evaluation.startedAt || evaluation.completedAt) && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Created</span>
                <span>{new Date(evaluation.createdAt).toLocaleString()}</span>
              </div>
              {evaluation.startedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Started Processing</span>
                  <span>{new Date(evaluation.startedAt).toLocaleString()}</span>
                </div>
              )}
              {evaluation.completedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed</span>
                  <span>{new Date(evaluation.completedAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}