'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  FileText, 
  RefreshCw,
  BarChart3,
  Zap,
  Cloud,
  AlertTriangle
} from 'lucide-react'
import { 
  useEvaluationProgress, 
  formatTimeRemaining, 
  getStatusColor,
  getStatusBadgeVariant 
} from '@/hooks/useEvaluationProgress'

interface EvaluationProgressCardProps {
  evaluationId: string
  onComplete?: () => void
}

export function EvaluationProgressCard({ 
  evaluationId, 
  onComplete 
}: EvaluationProgressCardProps) {
  const { 
    progress, 
    loading, 
    error, 
    refresh,
    isComplete,
    isProcessing
  } = useEvaluationProgress({
    evaluationId,
    enabled: true,
    pollInterval: 2000,
    onComplete: (progress) => {
      console.log('✅ Evaluation complete:', progress)
      onComplete?.()
    }
  })

  if (loading && !progress) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2">Loading progress...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <div className="flex-1">
              <p className="text-red-600 font-medium">Error loading progress</p>
              <p className="text-sm text-gray-600">{error.message}</p>
            </div>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!progress) return null

  const { evaluation, progress: prog, files, systemStatus } = progress

  // Determine processing mode icon
  const getModeIcon = () => {
    switch (systemStatus.processingMode) {
      case 'direct':
        return <Zap className="w-4 h-4 text-yellow-500" />
      case 'hybrid':
        return <Cloud className="w-4 h-4 text-blue-500" />
      case 'async':
        return <BarChart3 className="w-4 h-4 text-purple-500" />
      default:
        return <AlertTriangle className="w-4 h-4 text-orange-500" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'processing':
        return <Clock className="w-5 h-5 text-blue-600 animate-pulse" />
      default:
        return <FileText className="w-5 h-5 text-gray-400" />
    }
  }

  return (
    <div className="space-y-4">
      {/* Main Progress Card */}
      <Card className={isComplete ? 'border-green-200' : 'border-blue-200'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(evaluation.status)}
              <div>
                <CardTitle>Evaluation Progress</CardTitle>
                <CardDescription>{evaluation.roleTitle}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getModeIcon()}
              <Badge variant={getStatusBadgeVariant(evaluation.status)}>
                {evaluation.status.replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Overall Progress</span>
              <span className="font-medium">{prog.progressPercentage}%</span>
            </div>
            <Progress 
              value={prog.progressPercentage} 
              className={`h-3 ${isComplete ? 'bg-green-100' : ''}`}
            />
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{prog.totalFiles}</p>
              <p className="text-xs text-gray-600">Total Files</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{prog.processedFiles}</p>
              <p className="text-xs text-gray-600">Processed</p>
            </div>
            {prog.failedFiles > 0 && (
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{prog.failedFiles}</p>
                <p className="text-xs text-gray-600">Failed</p>
              </div>
            )}
            {prog.averageScore !== null && (
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">{prog.averageScore}%</p>
                <p className="text-xs text-gray-600">Avg Score</p>
              </div>
            )}
          </div>

          {/* Time Information */}
          {isProcessing && (
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-sm">Estimated time remaining:</span>
              </div>
              <span className="text-sm font-medium text-blue-600">
                {formatTimeRemaining(prog.estimatedTimeRemaining)}
              </span>
            </div>
          )}

          {/* Completion Message */}
          {prog.completionMessage && (
            <div className={`p-3 rounded-lg ${
              evaluation.status === 'completed' ? 'bg-green-50' : 
              evaluation.status === 'failed' ? 'bg-red-50' : 'bg-yellow-50'
            }`}>
              <p className={`text-sm ${
                evaluation.status === 'completed' ? 'text-green-700' : 
                evaluation.status === 'failed' ? 'text-red-700' : 'text-yellow-700'
              }`}>
                {prog.completionMessage}
              </p>
            </div>
          )}

          {/* System Status */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              {systemStatus.azureHealthy ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>System Healthy</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                  <span>Degraded Mode</span>
                </>
              )}
            </div>
            <span>Mode: {systemStatus.processingMode}</span>
          </div>
        </CardContent>
      </Card>

      {/* File Details Card */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">File Processing Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-2 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(file.status)}
                    <div>
                      <p className="text-sm font-medium truncate max-w-xs">
                        {file.filename}
                      </p>
                      {file.processingTimeMs && (
                        <p className="text-xs text-gray-500">
                          {(file.processingTimeMs / 1000).toFixed(1)}s
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {file.score !== undefined && (
                      <Badge variant="outline">{file.score}%</Badge>
                    )}
                    <Badge variant={getStatusBadgeVariant(file.status)}>
                      {file.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}