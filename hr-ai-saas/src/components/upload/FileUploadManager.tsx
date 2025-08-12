"use client"

import React, { useState, useCallback } from 'react'
import { FileDropzone } from './FileDropzone'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Upload, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

// Removed UploadSession interface as it's not used

interface FileUploadInfo {
  file: File
  uploadUrl: string
  blobName: string
  fileId: string
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  error?: string
}

interface FileUploadManagerProps {
  roleId?: string
  evaluationId?: string
  onUploadComplete?: (files?: any[]) => void
}

export function FileUploadManager({ roleId, evaluationId, onUploadComplete }: FileUploadManagerProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [fileUploads, setFileUploads] = useState<FileUploadInfo[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()

  const handleFilesSelected = useCallback((files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files])
  }, [])

  const initiateUpload = async () => {
    if (selectedFiles.length === 0) return

    setIsUploading(true)

    try {
      // Step 1: Initiate upload session
      const initiateResponse = await fetch('/api/upload/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: selectedFiles.map(f => ({
            name: f.name,
            size: f.size,
            type: f.type
          })),
          roleId
        })
      })

      if (!initiateResponse.ok) {
        throw new Error('Failed to initiate upload')
      }

      const { data } = await initiateResponse.json()

      // Map files with upload info
      const uploadInfos: FileUploadInfo[] = data.files.map((fileData: { uploadUrl: string; blobName: string; fileId: string }, index: number) => ({
        file: selectedFiles[index],
        uploadUrl: fileData.uploadUrl,
        blobName: fileData.blobName,
        fileId: fileData.fileId,
        progress: 0,
        status: 'pending' as const
      }))

      setFileUploads(uploadInfos)

      // Step 2: Upload files in batches
      const batchSize = 3 // Upload 3 files concurrently
      const uploadResults: PromiseSettledResult<void>[] = []

      for (let i = 0; i < uploadInfos.length; i += batchSize) {
        const batch = uploadInfos.slice(i, i + batchSize)
        const batchPromises = batch.map(fileInfo => uploadFile(fileInfo))
        const batchResults = await Promise.allSettled(batchPromises)
        uploadResults.push(...batchResults)
      }

      // Step 3: Complete upload session
      const completedFiles = uploadInfos.filter((_, index) => 
        uploadResults[index].status === 'fulfilled'
      ).map(f => ({
        fileId: f.fileId,
        blobName: f.blobName
      }))

      if (completedFiles.length > 0) {
        await completeUploadSession(data.session.sessionToken, completedFiles)
        
        // If evaluationId is provided, add files to evaluation
        if (evaluationId) {
          try {
            const evaluationResponse = await fetch(`/api/evaluations/${evaluationId}/files`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                files: completedFiles.map(f => ({
                  fileName: uploadInfos.find(u => u.fileId === f.fileId)?.file.name || '',
                  blobName: f.blobName,
                  fileSize: uploadInfos.find(u => u.fileId === f.fileId)?.file.size || 0
                }))
              })
            })
            
            if (!evaluationResponse.ok) {
              console.error('Failed to add files to evaluation')
            }
          } catch (error) {
            console.error('Error adding files to evaluation:', error)
          }
        }
      }

      // Show completion toast
      const successCount = uploadResults.filter(r => r.status === 'fulfilled').length
      const failureCount = uploadResults.filter(r => r.status === 'rejected').length

      if (successCount > 0) {
        toast({
          title: "Upload Complete",
          description: `Successfully uploaded ${successCount} file${successCount > 1 ? 's' : ''}${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
          duration: 5000
        })
      } else {
        toast({
          title: "Upload Failed",
          description: "All files failed to upload. Please try again.",
          variant: "destructive",
          duration: 5000
        })
      }

      if (onUploadComplete) {
        const uploadedFilesData = completedFiles.map(f => ({
          fileId: f.fileId,
          fileName: uploadInfos.find(u => u.fileId === f.fileId)?.file.name || '',
          blobName: f.blobName,
          fileSize: uploadInfos.find(u => u.fileId === f.fileId)?.file.size || 0
        }))
        onUploadComplete(uploadedFilesData)
      }

    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: "Upload Error",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive",
        duration: 5000
      })
    } finally {
      setIsUploading(false)
    }
  }

  const uploadFile = async (fileInfo: FileUploadInfo): Promise<void> => {
    try {
      // Update status to uploading
      updateFileUploadStatus(fileInfo.fileId, 'uploading', 0)

      // Create XMLHttpRequest for progress tracking
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        // Track upload progress
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            updateFileUploadStatus(fileInfo.fileId, 'uploading', progress)
          }
        }

        xhr.onload = () => {
          if (xhr.status === 201 || xhr.status === 200) {
            updateFileUploadStatus(fileInfo.fileId, 'completed', 100)
            resolve()
          } else {
            updateFileUploadStatus(fileInfo.fileId, 'failed', 0, 'Upload failed')
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        }

        xhr.onerror = () => {
          updateFileUploadStatus(fileInfo.fileId, 'failed', 0, 'Network error')
          reject(new Error('Network error'))
        }

        // Send the file
        xhr.open('PUT', fileInfo.uploadUrl)
        xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob')
        xhr.setRequestHeader('Content-Type', fileInfo.file.type)
        xhr.send(fileInfo.file)
      })

    } catch (error) {
      updateFileUploadStatus(fileInfo.fileId, 'failed', 0, error instanceof Error ? error.message : 'Upload failed')
      throw error
    }
  }

  const updateFileUploadStatus = (
    fileId: string, 
    status: FileUploadInfo['status'], 
    progress: number,
    error?: string
  ) => {
    setFileUploads(prev => prev.map(f => 
      f.fileId === fileId 
        ? { ...f, status, progress, error }
        : f
    ))
  }

  const completeUploadSession = async (sessionToken: string, files: Array<{ fileId: string; blobName: string }>) => {
    const response = await fetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionToken,
        files
      })
    })

    if (!response.ok) {
      throw new Error('Failed to complete upload session')
    }
  }

  const clearAll = () => {
    setSelectedFiles([])
    setFileUploads([])
  }

  const totalProgress = fileUploads.length > 0
    ? Math.round(fileUploads.reduce((acc, f) => acc + f.progress, 0) / fileUploads.length)
    : 0

  const completedCount = fileUploads.filter(f => f.status === 'completed').length
  const failedCount = fileUploads.filter(f => f.status === 'failed').length

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      {!isUploading && fileUploads.length === 0 && (
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          maxFiles={100}
          maxSize={10 * 1024 * 1024} // 10MB
        />
      )}

      {/* Selected Files Summary */}
      {selectedFiles.length > 0 && !isUploading && fileUploads.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium mb-2">
            Ready to upload {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
          </h3>
          <div className="flex items-center space-x-4">
            <Button
              onClick={initiateUpload}
              disabled={selectedFiles.length === 0}
              className="flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>Start Upload</span>
            </Button>
            <Button
              variant="outline"
              onClick={clearAll}
            >
              Clear All
            </Button>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="bg-blue-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium flex items-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Uploading Files...</span>
            </h3>
            <span className="text-sm text-gray-600">
              {completedCount} of {fileUploads.length} completed
            </span>
          </div>

          <Progress value={totalProgress} className="h-2 mb-4" />

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {fileUploads.map((upload) => (
              <div key={upload.fileId} className="flex items-center space-x-3 text-sm">
                <div className="w-5 h-5">
                  {upload.status === 'completed' && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {upload.status === 'failed' && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  {upload.status === 'uploading' && (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  )}
                  {upload.status === 'pending' && (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                </div>
                <span className="flex-1 truncate">{upload.file.name}</span>
                <span className="text-gray-500">
                  {upload.status === 'uploading' ? `${upload.progress}%` : upload.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Complete */}
      {!isUploading && fileUploads.length > 0 && (
        <div className="bg-green-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Upload Complete</span>
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-semibold text-green-600">{completedCount}</p>
              <p className="text-sm text-gray-600">Successful</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-red-600">{failedCount}</p>
              <p className="text-sm text-gray-600">Failed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-blue-600">{fileUploads.length}</p>
              <p className="text-sm text-gray-600">Total</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Button onClick={clearAll} variant="outline">
              Upload More Files
            </Button>
            {roleId && (
              <Button variant="default" asChild>
                <a href={`/dashboard/roles/${roleId}/results`}>View Results</a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}