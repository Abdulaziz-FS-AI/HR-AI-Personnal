'use client'

import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Upload, FileText, Clock, AlertCircle, CheckCircle, X } from 'lucide-react'

interface BulkUploadProps {
  roleId?: string
  onUploadComplete?: (sessionId: string) => void
}

interface UploadFile {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  progress: number
  error?: string
  uploadUrl?: string
  fileId?: string
}

export function BulkUploadManager({ roleId, onUploadComplete }: BulkUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isInitiating, setIsInitiating] = useState(false)
  const [uploadSession, setUploadSession] = useState<any>(null)
  const [notificationEmail, setNotificationEmail] = useState('')

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending' as const,
      progress: 0
    }))
    
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 150,
    maxSize: 10 * 1024 * 1024 // 10MB
  })

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const initiateUpload = async () => {
    if (files.length === 0) return

    setIsInitiating(true)
    try {
      const response = await fetch('/api/upload/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: files.map(f => ({
            filename: f.file.name,
            size: f.file.size,
            type: f.file.type
          })),
          roleId,
          notificationEmail: notificationEmail || undefined,
          processingPriority: 'normal'
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to initiate upload')
      }

      setUploadSession(result.data)
      
      // Start uploading files
      await uploadFiles(result.data.uploadUrls)
      
      if (onUploadComplete) {
        onUploadComplete(result.data.sessionId)
      }

    } catch (error) {
      console.error('Upload initiation failed:', error)
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsInitiating(false)
    }
  }

  const uploadFiles = async (uploadUrls: any[]) => {
    const uploadPromises = files.map(async (file, index) => {
      const uploadUrl = uploadUrls[index]
      if (!uploadUrl) return

      try {
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'uploading', progress: 0 } : f
        ))

        // Upload to Azure Blob Storage
        const uploadResponse = await fetch(uploadUrl.uploadUrl, {
          method: 'PUT',
          body: file.file,
          headers: {
            'x-ms-blob-type': 'BlockBlob',
            'Content-Type': file.file.type
          }
        })

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`)
        }

        setFiles(prev => prev.map(f => 
          f.id === file.id ? { 
            ...f, 
            status: 'completed', 
            progress: 100,
            fileId: uploadUrl.fileId 
          } : f
        ))

      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { 
            ...f, 
            status: 'failed', 
            error: error instanceof Error ? error.message : 'Upload failed'
          } : f
        ))
      }
    })

    await Promise.all(uploadPromises)
  }

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className=\"w-4 h-4 text-green-600\" />
      case 'failed':
        return <AlertCircle className=\"w-4 h-4 text-red-600\" />
      case 'uploading':
        return <Clock className=\"w-4 h-4 text-blue-600\" />
      default:
        return <FileText className=\"w-4 h-4 text-gray-400\" />
    }
  }

  const totalFiles = files.length
  const completedFiles = files.filter(f => f.status === 'completed').length
  const failedFiles = files.filter(f => f.status === 'failed').length
  const uploadingFiles = files.filter(f => f.status === 'uploading').length

  return (
    <div className=\"space-y-6\">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className=\"flex items-center gap-2\">
            <Upload className=\"w-5 h-5\" />
            Bulk PDF Upload
          </CardTitle>
          <CardDescription>
            Upload up to 150 PDF resumes for bulk processing. Processing will start automatically after upload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className=\"space-y-4\">
            {/* Notification Email */}
            <div>
              <label className=\"block text-sm font-medium mb-2\">
                Notification Email (optional)
              </label>
              <input
                type=\"email\"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                placeholder=\"Get notified when processing is complete\"
                className=\"w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500\"
              />
            </div>

            {/* Drop Zone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${\n                isDragActive \n                  ? 'border-blue-500 bg-blue-50' \n                  : 'border-gray-300 hover:border-gray-400'\n              }`}
            >
              <input {...getInputProps()} />
              <Upload className=\"w-12 h-12 mx-auto mb-4 text-gray-400\" />
              {isDragActive ? (
                <p className=\"text-blue-600\">Drop the PDF files here...</p>
              ) : (
                <div>
                  <p className=\"text-gray-600 mb-2\">
                    Drag & drop PDF files here, or click to select
                  </p>
                  <p className=\"text-sm text-gray-500\">
                    Maximum 150 files, 10MB each
                  </p>
                </div>
              )}
            </div>

            {/* Upload Button */}
            {files.length > 0 && (
              <Button 
                onClick={initiateUpload} 
                disabled={isInitiating || uploadSession}
                className=\"w-full\"
              >
                {isInitiating ? 'Initiating Upload...' : `Upload ${files.length} Files`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Progress</CardTitle>
            <CardDescription>
              {completedFiles}/{totalFiles} files uploaded
              {failedFiles > 0 && ` • ${failedFiles} failed`}
              {uploadingFiles > 0 && ` • ${uploadingFiles} uploading`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className=\"space-y-4\">
              {/* Overall Progress */}
              <div>
                <div className=\"flex justify-between text-sm mb-2\">
                  <span>Overall Progress</span>
                  <span>{Math.round((completedFiles / totalFiles) * 100)}%</span>
                </div>
                <Progress value={(completedFiles / totalFiles) * 100} />
              </div>

              {/* File List */}
              <div className=\"max-h-60 overflow-y-auto space-y-2\">
                {files.map((file) => (
                  <div key={file.id} className=\"flex items-center justify-between p-3 border rounded-lg\">
                    <div className=\"flex items-center gap-3\">
                      {getStatusIcon(file.status)}
                      <div>
                        <p className=\"text-sm font-medium truncate max-w-xs\">{file.file.name}</p>
                        <p className=\"text-xs text-gray-500\">
                          {(file.file.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                    </div>
                    
                    <div className=\"flex items-center gap-2\">
                      <Badge variant={
                        file.status === 'completed' ? 'default' :
                        file.status === 'failed' ? 'destructive' :
                        file.status === 'uploading' ? 'secondary' : 'outline'\n                      }>\n                        {file.status === 'uploading' ? `${file.progress}%` : file.status}\n                      </Badge>\n                      \n                      {file.status === 'pending' && (\n                        <Button\n                          variant=\"ghost\"\n                          size=\"sm\"\n                          onClick={() => removeFile(file.id)}\n                        >\n                          <X className=\"w-4 h-4\" />\n                        </Button>\n                      )}\n                    </div>\n                  </div>\n                ))}\n              </div>\n            </div>\n          </CardContent>\n        </Card>\n      )}\n\n      {/* Upload Session Info */}\n      {uploadSession && (\n        <Card>\n          <CardHeader>\n            <CardTitle className=\"text-green-600\">Upload Complete!</CardTitle>\n            <CardDescription>\n              Files uploaded successfully. Processing will begin automatically.\n            </CardDescription>\n          </CardHeader>\n          <CardContent>\n            <div className=\"space-y-2 text-sm\">\n              <p><strong>Session ID:</strong> {uploadSession.sessionId}</p>\n              <p><strong>Estimated Processing Time:</strong> {uploadSession.estimatedProcessingTime}</p>\n              <p><strong>Notification Method:</strong> {uploadSession.notificationMethod}</p>\n              <p className=\"text-blue-600\">\n                Track progress at: /dashboard/processing/{uploadSession.sessionId}\n              </p>\n            </div>\n          </CardContent>\n        </Card>\n      )}\n    </div>\n  )\n}"