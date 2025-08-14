"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { FileRow } from './FileRow'
import { 
  Archive, 
  Trash2, 
  RefreshCw, 
  Download, 
  FileText,
  Loader2
} from 'lucide-react'
import type { ResumeFile, FileFilters } from '@/lib/db-resume-library'

interface ResumeLibraryTableProps {
  filters?: FileFilters
  onFiltersChange?: (filters: FileFilters) => void
  refreshTrigger?: number
}

export function ResumeLibraryTable({ 
  filters = {}, 
  onFiltersChange,
  refreshTrigger = 0 
}: ResumeLibraryTableProps) {
  const [files, setFiles] = useState<ResumeFile[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  
  const { toast } = useToast()

  // Load files from API
  const loadFiles = useCallback(async () => {
    try {
      setLoading(true)
      
      const searchParams = new URLSearchParams()
      
      if (filters.status) searchParams.set('status', filters.status)
      if (filters.archived !== undefined) searchParams.set('archived', filters.archived.toString())
      if (filters.search) searchParams.set('search', filters.search)
      if (filters.dateRange) {
        searchParams.set('startDate', filters.dateRange.start.toISOString())
        searchParams.set('endDate', filters.dateRange.end.toISOString())
      }
      if (filters.tags) searchParams.set('tags', filters.tags.join(','))

      const response = await fetch(`/api/resume-library?${searchParams.toString()}`)
      
      if (!response.ok) {
        throw new Error('Failed to load files')
      }

      const data = await response.json()
      setFiles(data.files || [])
      
    } catch (error) {
      console.error('Error loading files:', error)
      toast({
        title: "Error",
        description: "Failed to load resume files",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [filters, toast])

  // Load files on mount and when filters change
  useEffect(() => {
    loadFiles()
  }, [loadFiles, refreshTrigger])

  // Handle individual file actions
  const handleFileAction = async (fileId: string, action: string, data?: any) => {
    setActionLoading(prev => ({ ...prev, [fileId]: true }))
    
    try {
      let response: Response
      
      switch (action) {
        case 'archive':
          response = await fetch(`/api/resume-library/${fileId}/archive`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archive: !files.find(f => f.id === fileId)?.isArchived })
          })
          break
          
        case 'delete':
          if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
            return
          }
          response = await fetch(`/api/resume-library/${fileId}`, {
            method: 'DELETE'
          })
          break
          
        case 'reprocess':
          response = await fetch(`/api/resume-library/${fileId}/reprocess`, {
            method: 'POST'
          })
          break
          
        case 'add-tag':
          response = await fetch(`/api/resume-library/${fileId}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tagName: data.tagName })
          })
          break
          
        case 'remove-tag':
          response = await fetch(`/api/resume-library/${fileId}/tags?tagName=${encodeURIComponent(data.tagName)}`, {
            method: 'DELETE'
          })
          break
          
        case 'add-note':
          response = await fetch(`/api/resume-library/${fileId}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ noteText: data.noteText })
          })
          break
          
        case 'export-text':
          const file = files.find(f => f.id === fileId)
          if (file?.extractedText) {
            downloadTextFile(file.extractedText, `${file.fileName}_extracted.txt`)
            toast({
              title: "Success",
              description: "Text exported successfully"
            })
          }
          return
          
        case 'quick-analyze':
          toast({
            title: "Analysis Started",
            description: "File queued for analysis with last used role"
          })
          return
          
        case 'analyze':
          toast({
            title: "Analysis",
            description: "Role selection for analysis (to be implemented)"
          })
          return
          
        case 'copy-success':
          toast({
            title: "Copied",
            description: data.message
          })
          return
          
        default:
          console.warn('Unknown action:', action)
          return
      }

      if (!response.ok) {
        throw new Error(`Action failed: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (result.success) {
        await loadFiles() // Reload files to reflect changes
        toast({
          title: "Success",
          description: result.message || "Action completed successfully"
        })
      } else {
        throw new Error(result.error || 'Unknown error')
      }
      
    } catch (error) {
      console.error('File action error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Action failed",
        variant: "destructive"
      })
    } finally {
      setActionLoading(prev => ({ ...prev, [fileId]: false }))
    }
  }

  // Handle bulk actions
  const handleBulkAction = async (action: 'archive' | 'delete') => {
    if (selectedFiles.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select files to perform bulk actions",
        variant: "destructive"
      })
      return
    }

    const fileIds = Array.from(selectedFiles)
    
    if (action === 'delete') {
      if (!confirm(`Are you sure you want to delete ${fileIds.length} file(s)? This action cannot be undone.`)) {
        return
      }
    }

    setBulkActionLoading(true)
    
    try {
      const response = await fetch('/api/resume-library', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, fileIds })
      })

      if (!response.ok) {
        throw new Error(`Bulk ${action} failed`)
      }

      const result = await response.json()
      
      if (result.success) {
        setSelectedFiles(new Set()) // Clear selection
        await loadFiles() // Reload files
        toast({
          title: "Success",
          description: `${result.affectedCount} file(s) ${action}d successfully`
        })
      } else {
        throw new Error(result.error || 'Bulk action failed')
      }
      
    } catch (error) {
      console.error('Bulk action error:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Bulk action failed",
        variant: "destructive"
      })
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Toggle file selection
  const toggleFileSelection = (fileId: string, selected: boolean) => {
    const newSelection = new Set(selectedFiles)
    if (selected) {
      newSelection.add(fileId)
    } else {
      newSelection.delete(fileId)
    }
    setSelectedFiles(newSelection)
  }

  // Select all files
  const selectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFiles(new Set(files.map(f => f.id)))
    } else {
      setSelectedFiles(new Set())
    }
  }

  // Toggle expanded file (accordion - only one at a time)
  const toggleExpanded = (fileId: string) => {
    setExpandedFile(expandedFile === fileId ? null : fileId)
  }

  // Download text as file
  const downloadTextFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const allSelected = files.length > 0 && selectedFiles.size === files.length
  const someSelected = selectedFiles.size > 0 && selectedFiles.size < files.length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-500" />
          <p className="text-gray-600 mt-2">Loading resume files...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      {selectedFiles.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('archive')}
                disabled={bulkActionLoading}
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('delete')}
                disabled={bulkActionLoading}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFiles(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Files Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        {files.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No resume files found</h3>
            <p className="text-gray-600">
              {Object.keys(filters).length > 0 
                ? "No files match your current filters."
                : "Upload some resume files to get started."
              }
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="w-12 px-4 py-3 text-left">
                  <Checkbox
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onCheckedChange={selectAll}
                  />
                </th>
                <th className="w-12 px-2 py-3"></th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  File Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  Uploaded
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  isSelected={selectedFiles.has(file.id)}
                  isExpanded={expandedFile === file.id}
                  isLoading={actionLoading[file.id] || false}
                  onSelect={(selected) => toggleFileSelection(file.id, selected)}
                  onToggleExpanded={() => toggleExpanded(file.id)}
                  onAction={(action, data) => handleFileAction(file.id, action, data)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={loadFiles}
          disabled={loading}
          className="flex items-center"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  )
}