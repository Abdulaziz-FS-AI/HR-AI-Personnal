"use client"

import React, { useCallback, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { Upload, FileText, X, AlertCircle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface FileUploadStatus {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  error?: string
  url?: string
}

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void
  onFilesChanged?: (fileStatuses: FileUploadStatus[]) => void
  maxFiles?: number
  maxSize?: number // in bytes
  accept?: Record<string, string[]>
  disabled?: boolean
}

export type { FileUploadStatus }

export function FileDropzone({
  onFilesSelected,
  onFilesChanged,
  maxFiles = 100,
  maxSize = 10 * 1024 * 1024, // 10MB default
  accept = { 'application/pdf': ['.pdf'] },
  disabled = false
}: FileDropzoneProps) {
  const [files, setFiles] = useState<FileUploadStatus[]>([])
  const [rejectedFiles, setRejectedFiles] = useState<Array<{ file: File; errors: string[] }>>([])

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
    // Clear previous rejections
    setRejectedFiles([])

    // Handle rejected files
    if (fileRejections.length > 0) {
      const rejected = fileRejections.map(rejection => ({
        file: rejection.file,
        errors: rejection.errors.map((e) => {
          if (e.code === 'file-too-large') {
            return `File is larger than ${maxSize / 1024 / 1024}MB`
          }
          if (e.code === 'file-invalid-type') {
            return 'Only PDF files are allowed'
          }
          if (e.code === 'too-many-files') {
            return `Maximum ${maxFiles} files allowed`
          }
          return e.message
        })
      }))
      setRejectedFiles(rejected)
    }

    // Handle accepted files
    if (acceptedFiles.length > 0) {
      const newFiles: FileUploadStatus[] = acceptedFiles.map(file => ({
        file,
        progress: 0,
        status: 'pending' as const
      }))
      
      setFiles(prev => {
        const updated = [...prev, ...newFiles]
        if (onFilesChanged) {
          onFilesChanged(updated)
        }
        return updated
      })
      onFilesSelected(acceptedFiles)
    }
  }, [maxSize, maxFiles, onFilesSelected, onFilesChanged])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    maxSize,
    disabled,
    multiple: true
  })

  const removeFile = (index: number) => {
    setFiles(prev => {
      const updated = prev.filter((_, i) => i !== index)
      if (onFilesChanged) {
        onFilesChanged(updated)
      }
      return updated
    })
  }

  const clearRejectedFiles = () => {
    setRejectedFiles([])
  }

  const totalSize = files.reduce((acc, f) => acc + f.file.size, 0)
  const completedCount = files.filter(f => f.status === 'completed').length
  const failedCount = files.filter(f => f.status === 'failed').length

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive && "border-primary bg-primary/5",
          disabled && "opacity-50 cursor-not-allowed",
          !isDragActive && !disabled && "border-gray-300 hover:border-primary/50"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-3">
          <Upload className={cn(
            "w-12 h-12",
            isDragActive ? "text-primary" : "text-gray-400"
          )} />
          
          {isDragActive ? (
            <p className="text-primary font-medium">Drop the files here...</p>
          ) : (
            <>
              <p className="text-gray-600">
                Drag & drop PDF files here, or click to select
              </p>
              <p className="text-sm text-gray-500">
                Maximum {maxFiles} files, up to {maxSize / 1024 / 1024}MB each
              </p>
            </>
          )}
        </div>
      </div>

      {/* Rejected Files */}
      {rejectedFiles.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-red-800">
                  {rejectedFiles.length} file{rejectedFiles.length > 1 ? 's' : ''} rejected
                </h4>
                <ul className="mt-2 space-y-1">
                  {rejectedFiles.map((rejection, index) => (
                    <li key={index} className="text-sm text-red-700">
                      <span className="font-medium">{rejection.file.name}</span>
                      {rejection.errors.map((error, i) => (
                        <span key={i} className="block text-xs mt-1 ml-2">
                          • {error}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <button
              onClick={clearRejectedFiles}
              className="text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Selected Files ({files.length})
            </h3>
            <div className="text-sm text-gray-500">
              Total: {(totalSize / 1024 / 1024).toFixed(2)}MB
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((fileStatus, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
              >
                <FileText className="w-5 h-5 text-gray-400" />
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {fileStatus.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(fileStatus.file.size / 1024 / 1024).toFixed(2)}MB
                  </p>
                  
                  {fileStatus.status === 'uploading' && (
                    <Progress value={fileStatus.progress} className="mt-1 h-1" />
                  )}
                  
                  {fileStatus.status === 'failed' && fileStatus.error && (
                    <p className="text-xs text-red-600 mt-1">{fileStatus.error}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {fileStatus.status === 'pending' && (
                    <span className="text-xs text-gray-500">Pending</span>
                  )}
                  {fileStatus.status === 'uploading' && (
                    <span className="text-xs text-blue-600">{fileStatus.progress}%</span>
                  )}
                  {fileStatus.status === 'completed' && (
                    <span className="text-xs text-green-600">✓ Uploaded</span>
                  )}
                  {fileStatus.status === 'failed' && (
                    <span className="text-xs text-red-600">Failed</span>
                  )}
                  
                  {fileStatus.status !== 'uploading' && (
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          {files.length > 0 && (
            <div className="flex items-center justify-between text-sm text-gray-600 pt-2 border-t">
              <span>
                {completedCount} completed, {failedCount} failed
              </span>
              {files.some(f => f.status === 'uploading') && (
                <span className="text-blue-600">Uploading...</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}