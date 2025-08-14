"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  AlertCircle
} from 'lucide-react'

interface ProgressData {
  evaluation: {
    id: string
    status: string
    roleTitle: string
  }
  progress: {
    totalFiles: number
    processedFiles: number
    failedFiles: number
    processingFiles: number
    pendingFiles: number
    progressPercentage: number
    averageScore?: number
    processingTimeSeconds?: number
    estimatedTimeRemaining?: number
  }
  files: Array<{
    id: string
    filename: string
    status: string
    score?: number
  }>
}

export default function EvaluationProgressPage() {
  const params = useParams()
  const router = useRouter()
  const evaluationId = params.id as string
  
  const [progressData, setProgressData] = useState<ProgressData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/evaluations/${evaluationId}/progress`)
        if (!response.ok) throw new Error('Failed to fetch progress')
        
        const data = await response.json()
        if (data.success) {
          setProgressData(data.data)
          
          // If completed, redirect to results
          if (data.data.evaluation.status === 'completed') {
            setTimeout(() => {
              router.push(`/evaluations/${evaluationId}`)
            }, 2000)
          }
        } else {
          setError(data.message || 'Failed to load progress')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    // Initial fetch
    fetchProgress()

    // Poll for updates every 3 seconds
    const interval = setInterval(fetchProgress, 3000)

    return () => clearInterval(interval)
  }, [evaluationId, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error || !progressData) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{error || 'Failed to load progress'}</p>
            <Button onClick={() => router.push('/evaluations')}>
              Back to Evaluations
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { evaluation, progress, files } = progressData

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => router.push('/evaluations')}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Evaluations
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Processing Evaluation</span>
            <Badge variant={evaluation.status === 'processing' ? 'default' : 'secondary'}>
              {evaluation.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Progress */}
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Overall Progress</span>
              <span>{progress.progressPercentage}%</span>
            </div>
            <Progress value={progress.progressPercentage} className="h-3" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <FileText className="w-6 h-6 mx-auto mb-1 text-gray-600" />
              <p className="text-2xl font-bold">{progress.totalFiles}</p>
              <p className="text-xs text-gray-600">Total Files</p>
            </div>
            
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 mx-auto mb-1 text-green-600" />
              <p className="text-2xl font-bold text-green-600">{progress.processedFiles}</p>
              <p className="text-xs text-gray-600">Processed</p>
            </div>
            
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <Loader2 className="w-6 h-6 mx-auto mb-1 text-blue-600 animate-spin" />
              <p className="text-2xl font-bold text-blue-600">{progress.processingFiles}</p>
              <p className="text-xs text-gray-600">Processing</p>
            </div>
            
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <XCircle className="w-6 h-6 mx-auto mb-1 text-red-600" />
              <p className="text-2xl font-bold text-red-600">{progress.failedFiles}</p>
              <p className="text-xs text-gray-600">Failed</p>
            </div>
          </div>

          {/* Time Estimate */}
          {progress.estimatedTimeRemaining && (
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>
                Estimated time remaining: {Math.ceil(progress.estimatedTimeRemaining / 60)} minutes
              </span>
            </div>
          )}

          {/* Average Score */}
          {progress.averageScore !== undefined && progress.averageScore !== null && (
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Average Score</p>
              <p className="text-3xl font-bold text-blue-600">
                {Math.round(progress.averageScore)}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File List */}
      <Card>
        <CardHeader>
          <CardTitle>Files Being Processed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-gray-500" />
                  <span className="text-sm font-medium">{file.filename}</span>
                </div>
                <div className="flex items-center space-x-3">
                  {file.score !== undefined && (
                    <span className="text-sm font-medium">
                      {Math.round(file.score)}%
                    </span>
                  )}
                  {file.status === 'completed' && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  {file.status === 'processing' && (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  )}
                  {file.status === 'failed' && (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  {file.status === 'pending' && (
                    <Clock className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}