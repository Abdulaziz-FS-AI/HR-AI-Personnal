import { useState, useEffect, useCallback, useRef } from 'react'

export interface EvaluationProgress {
  evaluation: {
    id: string
    status: string
    roleTitle: string
    createdAt: string
    updatedAt: string
  }
  progress: {
    totalFiles: number
    processedFiles: number
    failedFiles: number
    processingFiles: number
    pendingFiles: number
    progressPercentage: number
    averageScore: number | null
    processingTimeSeconds: number
    estimatedTimeRemaining: number | null
    completionMessage?: string
  }
  files: Array<{
    id: string
    filename: string
    status: string
    score?: number
    processingTimeMs?: number
    createdAt: string
    updatedAt: string
  }>
  systemStatus: {
    azureHealthy: boolean
    lastHealthCheck: string
    processingMode: string
  }
}

interface UseEvaluationProgressOptions {
  evaluationId: string | null
  enabled?: boolean
  pollInterval?: number
  onComplete?: (progress: EvaluationProgress) => void
  onError?: (error: Error) => void
}

export function useEvaluationProgress({
  evaluationId,
  enabled = true,
  pollInterval = 2000, // Poll every 2 seconds by default
  onComplete,
  onError
}: UseEvaluationProgressOptions) {
  const [progress, setProgress] = useState<EvaluationProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const completedRef = useRef(false)

  const fetchProgress = useCallback(async () => {
    if (!evaluationId || !enabled) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/evaluations/${evaluationId}/progress`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch progress: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.success) {
        setProgress(data.data)

        // Check if evaluation is complete
        const isComplete = ['completed', 'failed', 'completed_with_errors'].includes(
          data.data.evaluation.status
        )

        if (isComplete && !completedRef.current) {
          completedRef.current = true
          onComplete?.(data.data)
          
          // Stop polling
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
      } else {
        throw new Error(data.message || 'Failed to fetch progress')
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      onError?.(error)
    } finally {
      setLoading(false)
    }
  }, [evaluationId, enabled, onComplete, onError])

  // Initial fetch
  useEffect(() => {
    if (evaluationId && enabled) {
      fetchProgress()
    }
  }, [evaluationId, enabled, fetchProgress])

  // Set up polling
  useEffect(() => {
    if (!evaluationId || !enabled) return

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Don't poll if already completed
    if (completedRef.current) return

    // Set up new interval
    intervalRef.current = setInterval(fetchProgress, pollInterval)

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [evaluationId, enabled, pollInterval, fetchProgress])

  // Reset completed flag when evaluation ID changes
  useEffect(() => {
    completedRef.current = false
  }, [evaluationId])

  const refresh = useCallback(() => {
    fetchProgress()
  }, [fetchProgress])

  const reset = useCallback(() => {
    setProgress(null)
    setError(null)
    setLoading(false)
    completedRef.current = false
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  return {
    progress,
    loading,
    error,
    refresh,
    reset,
    isComplete: completedRef.current,
    isProcessing: progress?.evaluation.status === 'processing'
  }
}

// Utility function to format time remaining
export function formatTimeRemaining(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return 'Calculating...'
  
  if (seconds < 60) {
    return `${seconds} seconds`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }
}

// Utility function to get status color
export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-green-600'
    case 'failed':
      return 'text-red-600'
    case 'processing':
      return 'text-blue-600'
    case 'pending':
      return 'text-gray-500'
    case 'completed_with_errors':
      return 'text-yellow-600'
    default:
      return 'text-gray-600'
  }
}

// Utility function to get status badge variant
export function getStatusBadgeVariant(status: string): 'default' | 'destructive' | 'secondary' | 'outline' {
  switch (status) {
    case 'completed':
      return 'default'
    case 'failed':
      return 'destructive'
    case 'processing':
      return 'secondary'
    default:
      return 'outline'
  }
}