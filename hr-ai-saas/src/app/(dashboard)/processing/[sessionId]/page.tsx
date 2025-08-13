'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { RefreshCw, Download, AlertCircle, CheckCircle, Clock, FileText, BarChart3 } from 'lucide-react'

interface BatchSession {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled'
  totalFiles: number
  totalProcessed: number
  totalFailed: number
  priority: string
  notificationEmail: string
  estimatedCompletionTime: string
  completedAt: string | null
  createdAt: string
  roleTitle?: string
}

interface FileStatus {
  id: string
  filename: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  score?: number
  error?: string
}

export default function ProcessingStatusPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  
  const [session, setSession] = useState<BatchSession | null>(null)
  const [files, setFiles] = useState<FileStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const [sessionResponse, filesResponse] = await Promise.all([
        fetch(`/api/batch/status/${sessionId}`),
        fetch(`/api/batch/files/${sessionId}`)
      ])

      if (!sessionResponse.ok || !filesResponse.ok) {
        throw new Error('Failed to fetch processing status')
      }

      const sessionData = await sessionResponse.json()
      const filesData = await filesResponse.json()

      setSession(sessionData.data)
      setFiles(filesData.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    
    // Refresh every 5 seconds if processing
    const interval = setInterval(() => {
      if (session?.status === 'processing' || session?.status === 'pending') {
        fetchData()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [sessionId, session?.status])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600'
      case 'failed': return 'text-red-600'
      case 'processing': return 'text-blue-600'
      case 'pending': return 'text-yellow-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'failed': return <AlertCircle className="w-4 h-4" />
      case 'processing': return <Clock className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  const progressPercentage = session ? 
    Math.round(((session.totalProcessed + session.totalFailed) / session.totalFiles) * 100) : 0

  const avgScore = files
    .filter(f => f.score !== undefined)
    .reduce((acc, f) => acc + (f.score || 0), 0) / 
    files.filter(f => f.score !== undefined).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Session</h3>
            <p className="text-gray-600 mb-4">{error || 'Session not found'}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bulk Processing Status</h1>
          <p className="text-gray-600">Session ID: {sessionId}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {session.status === 'completed' && (
            <Button>
              <Download className="w-4 h-4 mr-2" />
              Export Results
            </Button>
          )}
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${getStatusColor(session.status)} bg-opacity-10`}>
                {getStatusIcon(session.status)}
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className={`font-semibold ${getStatusColor(session.status)}`}>
                  {session.status.replace('_', ' ').toUpperCase()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-100">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Files</p>
                <p className="font-semibold">{session.totalFiles}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Processed</p>
                <p className="font-semibold">{session.totalProcessed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-100">
                <BarChart3 className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Score</p>
                <p className="font-semibold">{avgScore ? `${Math.round(avgScore)}%` : 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Processing Progress</h3>
              <span className="text-sm text-gray-600">{progressPercentage}% complete</span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
            <div className="flex justify-between text-sm text-gray-600">
              <span>Processed: {session.totalProcessed}</span>
              <span>Failed: {session.totalFailed}</span>
              <span>Remaining: {session.totalFiles - session.totalProcessed - session.totalFailed}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Details */}
      <Card>
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-gray-600">Created At</p>
              <p>{new Date(session.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="font-medium text-gray-600">Estimated Completion</p>
              <p>{new Date(session.estimatedCompletionTime).toLocaleString()}</p>
            </div>
            <div>
              <p className="font-medium text-gray-600">Priority</p>
              <Badge variant="outline">{session.priority.toUpperCase()}</Badge>
            </div>
            <div>
              <p className="font-medium text-gray-600">Notification Email</p>
              <p>{session.notificationEmail}</p>
            </div>
            {session.roleTitle && (
              <div>
                <p className="font-medium text-gray-600">Role</p>
                <p>{session.roleTitle}</p>
              </div>
            )}
            {session.completedAt && (
              <div>
                <p className="font-medium text-gray-600">Completed At</p>
                <p>{new Date(session.completedAt).toLocaleString()}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File Status */}
      <Card>
        <CardHeader>
          <CardTitle>File Processing Status</CardTitle>
          <CardDescription>
            Individual file processing progress and results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={getStatusColor(file.status)}>
                    {getStatusIcon(file.status)}
                  </div>
                  <div>
                    <p className="font-medium truncate max-w-xs">{file.filename}</p>
                    {file.error && (
                      <p className="text-xs text-red-600">{file.error}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {file.score !== undefined && (
                    <Badge variant="outline">{file.score}%</Badge>
                  )}
                  <Badge variant={
                    file.status === 'completed' ? 'default' :
                    file.status === 'failed' ? 'destructive' :
                    file.status === 'processing' ? 'secondary' : 'outline'
                  }>
                    {file.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Processing Complete Message */}
      {session.status === 'completed' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-800">Processing Complete!</h3>
                <p className="text-green-700">
                  All {session.totalProcessed} files have been processed successfully.
                  {avgScore && ` Average score: ${Math.round(avgScore)}%`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {session.status === 'failed' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-800">Processing Failed</h3>
                <p className="text-red-700">
                  The bulk processing session has failed. Please check individual file errors above.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}