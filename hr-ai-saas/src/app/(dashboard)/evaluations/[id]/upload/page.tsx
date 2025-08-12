"use client"

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { FileUploadManager } from '@/components/upload/FileUploadManager'
import { useToast } from '@/hooks/use-toast'
import { 
  ArrowLeft, 
  FileText, 
  Upload, 
  PlayCircle,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'

interface EvaluationDetails {
  id: string
  name: string
  description: string | null
  roleId: string
  status: string
  totalFiles: number
}

export default function EvaluationUploadPage() {
  const router = useRouter()
  const params = useParams()
  const { data: session } = useSession()
  const { toast } = useToast()
  
  const evaluationId = params.id as string
  const [evaluation, setEvaluation] = useState<EvaluationDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  
  useEffect(() => {
    if (evaluationId && session?.user?.id) {
      fetchEvaluation()
    }
  }, [evaluationId, session])
  
  const fetchEvaluation = async () => {
    try {
      const response = await fetch(`/api/evaluations?id=${evaluationId}`)
      if (response.ok) {
        const data = await response.json()
        setEvaluation(data.evaluation)
      } else {
        toast({
          title: "Error",
          description: "Failed to load evaluation details",
          variant: "destructive"
        })
        router.push('/evaluations')
      }
    } catch (error) {
      console.error('Error fetching evaluation:', error)
      toast({
        title: "Error",
        description: "Failed to load evaluation",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  
  const handleStartProcessing = async () => {
    if (!evaluation || uploadedFiles.length === 0) return
    
    try {
      setUploading(true)
      
      const response = await fetch(`/api/evaluations/${evaluationId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        toast({
          title: "Processing Started",
          description: "AI analysis has begun. You can monitor progress in the evaluations page.",
        })
        
        // Redirect to evaluation details/progress page
        router.push(`/evaluations/${evaluationId}`)
      } else {
        throw new Error('Failed to start processing')
      }
    } catch (error) {
      console.error('Error starting processing:', error)
      toast({
        title: "Error",
        description: "Failed to start processing",
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }
  }
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading evaluation...</p>
          </div>
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
              The evaluation you're looking for doesn't exist or you don't have access to it.
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
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/evaluations">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Evaluations
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Upload Resumes</h1>
            <p className="text-gray-600 mt-1">
              {evaluation.name}
            </p>
          </div>
        </div>
      </div>
      
      {/* Evaluation Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Evaluation Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Name</p>
              <p className="font-medium">{evaluation.name}</p>
            </div>
            <div>
              <p className="text-gray-600">Status</p>
              <p className="font-medium capitalize">{evaluation.status}</p>
            </div>
            <div>
              <p className="text-gray-600">Files Uploaded</p>
              <p className="font-medium">{evaluation.totalFiles}</p>
            </div>
          </div>
          {evaluation.description && (
            <div className="mt-4">
              <p className="text-gray-600 text-sm">Description</p>
              <p className="text-sm mt-1">{evaluation.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Upload Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            Upload Resume Files
          </CardTitle>
          <CardDescription>
            Upload PDF files for this evaluation. You can upload up to 150 files at once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploadManager 
            evaluationId={evaluationId}
            onUploadComplete={(files) => {
              if (files && files.length > 0) {
                setUploadedFiles(files)
              }
            }}
          />
          
          {uploadedFiles.length > 0 && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <div>
                    <p className="font-medium text-green-900">
                      {uploadedFiles.length} files ready for processing
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      Click the button below to start AI analysis
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={handleStartProcessing}
                  disabled={uploading}
                  className="ml-4"
                >
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Start Processing
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Upload Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start">
              <span className="text-blue-600 mr-2">1.</span>
              <p>Upload PDF files only. Each file should be under 10MB.</p>
            </div>
            <div className="flex items-start">
              <span className="text-blue-600 mr-2">2.</span>
              <p>You can upload multiple files at once, up to 150 files per evaluation.</p>
            </div>
            <div className="flex items-start">
              <span className="text-blue-600 mr-2">3.</span>
              <p>After uploading, click "Start Processing" to begin AI analysis.</p>
            </div>
            <div className="flex items-start">
              <span className="text-blue-600 mr-2">4.</span>
              <p>Processing may take several minutes depending on the number of files.</p>
            </div>
            <div className="flex items-start">
              <span className="text-blue-600 mr-2">5.</span>
              <p>You'll be notified when the analysis is complete.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}