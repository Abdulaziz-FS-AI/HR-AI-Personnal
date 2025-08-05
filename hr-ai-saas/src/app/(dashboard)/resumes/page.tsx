"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResumeLibraryTable } from '@/components/resume-library/ResumeLibraryTable'
import { FileFilters } from '@/components/resume-library/FileFilters'
import { 
  Upload, 
  FolderOpen, 
  Archive, 
  Trash2,
  FileText,
  Loader2,
  BarChart3
} from 'lucide-react'
import Link from 'next/link'
import type { FileFilters as IFileFilters } from '@/lib/db-resume-library'

export default function ResumeLibraryPage() {
  const [filters, setFilters] = useState<IFileFilters>({})
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [stats, setStats] = useState({
    total: 0,
    ready: 0,
    processing: 0,
    failed: 0,
    archived: 0
  })

  const handleFiltersChange = (newFilters: IFileFilters) => {
    setFilters(newFilters)
  }

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Resume Library</h1>
          <p className="text-gray-600 mt-1">
            Manage and organize your uploaded resume files
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button asChild variant="outline">
            <Link href="/dashboard/resumes/upload">
              <Upload className="w-4 h-4 mr-2" />
              Upload Resumes
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/evaluations">
              <BarChart3 className="w-4 h-4 mr-2" />
              Start Analysis
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Files</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ready</p>
                <p className="text-2xl font-bold text-green-600">{stats.ready}</p>
              </div>
              <FolderOpen className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Processing</p>
                <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
              </div>
              <Loader2 className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <FileText className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Archived</p>
                <p className="text-2xl font-bold text-gray-600">{stats.archived}</p>
              </div>
              <Archive className="w-8 h-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Button
          variant="outline"
          className="h-16 flex-col space-y-2"
          onClick={() => setFilters({ status: 'ready', archived: false })}
        >
          <FolderOpen className="w-6 h-6" />
          <span>Ready for Analysis</span>
        </Button>

        <Button
          variant="outline"
          className="h-16 flex-col space-y-2"
          onClick={() => setFilters({ status: 'processing' })}
        >
          <Loader2 className="w-6 h-6" />
          <span>Processing</span>
        </Button>

        <Button
          variant="outline"
          className="h-16 flex-col space-y-2"
          onClick={() => setFilters({ status: 'failed' })}
        >
          <FileText className="w-6 h-6" />
          <span>Failed Processing</span>
        </Button>

        <Button
          variant="outline"
          className="h-16 flex-col space-y-2"
          onClick={() => setFilters({ archived: true })}
        >
          <Archive className="w-6 h-6" />
          <span>Archived Files</span>
        </Button>
      </div>

      {/* Filters */}
      <FileFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        totalFiles={stats.total}
        filteredFiles={stats.total} // This would be calculated based on current filters
      />

      {/* Main Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Resume Files</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={triggerRefresh}
            >
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ResumeLibraryTable
            filters={filters}
            onFiltersChange={handleFiltersChange}
            refreshTrigger={refreshTrigger}
          />
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Getting Started</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <Upload className="w-4 h-4 mr-2 text-blue-600" />
                1. Upload Resumes
              </h4>
              <p className="text-gray-600">
                Upload PDF resume files using our drag & drop interface. 
                You can upload up to 150 files at once.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <FileText className="w-4 h-4 mr-2 text-green-600" />
                2. Text Processing
              </h4>
              <p className="text-gray-600">
                Files are automatically processed to extract text content. 
                You can retry failed extractions or reprocess files.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center">
                <BarChart3 className="w-4 h-4 mr-2 text-purple-600" />
                3. AI Analysis
              </h4>
              <p className="text-gray-600">
                Once processed, files are ready for AI analysis against 
                your job roles. Start analysis from the Analysis Hub.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}