"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileUploadManager } from '@/components/upload/FileUploadManager'
import { ArrowLeft, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ResumeUploadPage() {
  const [uploadComplete, setUploadComplete] = useState(false)
  const [uploadStats, setUploadStats] = useState({
    total: 0,
    successful: 0,
    failed: 0
  })
  
  const router = useRouter()

  const handleUploadComplete = (stats?: { total: number; successful: number; failed: number }) => {
    setUploadComplete(true)
    if (stats) {
      setUploadStats(stats)
    }
  }

  const handleViewLibrary = () => {
    router.push('/resumes')
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/resumes">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Library
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Upload Resumes</h1>
            <p className="text-gray-600 mt-1">
              Add resume files to your library for processing and analysis
            </p>
          </div>
        </div>
      </div>

      {!uploadComplete ? (
        <>
          {/* Upload Guidelines */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Upload Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h4 className="font-semibold text-green-600">✓ Supported Formats</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• PDF files only</li>
                    <li>• Text-based PDFs (preferred)</li>
                    <li>• Scanned PDFs (with OCR fallback)</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-600">📏 File Requirements</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Maximum 10MB per file</li>
                    <li>• Up to 150 files per batch</li>
                    <li>• Clear, readable text content</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-purple-600">🔄 Processing</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Automatic text extraction</li>
                    <li>• Contact info detection</li>
                    <li>• Skills & experience parsing</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upload Interface */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="w-5 h-5 mr-2" />
                Upload Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FileUploadManager 
                onUploadComplete={handleUploadComplete}
              />
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle>💡 Tips for Best Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">File Quality</h4>
                    <p className="text-gray-600">
                      Use high-quality PDF files with clear, readable text. 
                      Avoid heavily formatted or image-only resumes.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900">Naming Convention</h4>
                    <p className="text-gray-600">
                      Use descriptive filenames like &quot;John_Smith_Resume.pdf&quot; 
                      for easier organization and identification.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">Batch Processing</h4>
                    <p className="text-gray-600">
                      Upload multiple files at once for efficient processing. 
                      Files are processed in the background.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900">After Upload</h4>
                    <p className="text-gray-600">
                      Files will be processed automatically. You can monitor 
                      progress and retry failed extractions in the library.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        /* Upload Complete */
        <Card>
          <CardContent className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Complete!</h2>
            <p className="text-gray-600 mb-6">
              Your resume files have been uploaded and are being processed.
            </p>
            
            {uploadStats.total > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6 max-w-md mx-auto">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{uploadStats.total}</p>
                    <p className="text-sm text-gray-600">Total Files</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{uploadStats.successful}</p>
                    <p className="text-sm text-gray-600">Successful</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{uploadStats.failed}</p>
                    <p className="text-sm text-gray-600">Failed</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <Button onClick={handleViewLibrary} size="lg">
                <FileText className="w-4 h-4 mr-2" />
                View Resume Library
              </Button>
              
              <div className="flex justify-center space-x-4">
                <Button variant="outline" onClick={() => setUploadComplete(false)}>
                  Upload More Files
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/analysis">
                    Start Analysis
                  </Link>
                </Button>
              </div>
            </div>
            
            {uploadStats.failed > 0 && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center text-yellow-800">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  <span className="text-sm">
                    Some files failed to upload. You can retry them from the Resume Library.
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}