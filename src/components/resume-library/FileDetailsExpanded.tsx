"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  RotateCcw, 
  Archive, 
  Tag, 
  Download, 
  Microscope, 
  FileText, 
  Copy,
  StickyNote,
  Trash2,
  Calendar,
  HardDrive,
  CheckCircle,
  AlertCircle,
  Plus,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResumeFile } from '@/lib/db-resume-library'

interface FileDetailsExpandedProps {
  file: ResumeFile
  onAction: (action: string, data?: any) => void
  isLoading: boolean
}

export function FileDetailsExpanded({ file, onAction, isLoading }: FileDetailsExpandedProps) {
  const [newTag, setNewTag] = useState('')
  const [newNote, setNewNote] = useState('')
  const [showAddTag, setShowAddTag] = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const handleAddTag = () => {
    if (newTag.trim()) {
      onAction('add-tag', { tagName: newTag.trim() })
      setNewTag('')
      setShowAddTag(false)
    }
  }

  const handleAddNote = () => {
    if (newNote.trim()) {
      onAction('add-note', { noteText: newNote.trim() })
      setNewNote('')
      setShowAddNote(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    onAction('copy-success', { message: 'Copied to clipboard' })
  }

  const extractedTextPreview = file.extractedText 
    ? file.extractedText.slice(0, 500) + (file.extractedText.length > 500 ? '...' : '')
    : 'No text extracted'

  const tags = file.tagList ? file.tagList.split(',').map(t => t.trim()).filter(Boolean) : []

  return (
    <div className="bg-gray-50 border-t">
      <div className="px-6 py-4">
        {/* File Details Section */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <FileText className="w-4 h-4 mr-2" />
            File Details
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Size:</span>
              <span className="ml-2 font-medium">{formatFileSize(file.fileSize)}</span>
            </div>
            <div>
              <span className="text-gray-600">Type:</span>
              <span className="ml-2 font-medium">{file.fileType}</span>
            </div>
            <div>
              <span className="text-gray-600">Uploaded:</span>
              <span className="ml-2 font-medium">{formatDate(file.uploadedAt)}</span>
            </div>
            <div>
              <span className="text-gray-600">Confidence:</span>
              <span className={cn(
                "ml-2 font-medium",
                file.extractionConfidence >= 80 ? "text-green-600" :
                file.extractionConfidence >= 60 ? "text-yellow-600" : "text-red-600"
              )}>
                {file.extractionConfidence}%
              </span>
            </div>
          </div>
        </div>

        {/* Tags Section */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <Tag className="w-4 h-4 mr-2" />
            Tags
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddTag(!showAddTag)}
              className="ml-2 h-6 w-6 p-0"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </h4>
          
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                {tag}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAction('remove-tag', { tagName: tag })}
                  className="h-4 w-4 p-0 hover:bg-transparent"
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            ))}
            {tags.length === 0 && (
              <span className="text-sm text-gray-500 italic">No tags added</span>
            )}
          </div>
          
          {showAddTag && (
            <div className="flex gap-2 mt-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Enter tag name"
                className="flex-1"
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <Button onClick={handleAddTag} size="sm">
                Add
              </Button>
              <Button 
                onClick={() => setShowAddTag(false)} 
                variant="ghost" 
                size="sm"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {/* Extracted Text Preview */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <FileText className="w-4 h-4 mr-2" />
            Extracted Text Preview
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(file.extractedText || '')}
              className="ml-2 h-6 w-6 p-0"
              title="Copy full text"
            >
              <Copy className="w-3 h-3" />
            </Button>
          </h4>
          <div className="bg-white border rounded-lg p-3 text-sm">
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {extractedTextPreview}
            </pre>
            {file.extractedText && file.extractedText.length > 500 && (
              <Button
                variant="link"
                size="sm"
                onClick={() => onAction('view-full-text')}
                className="mt-2 p-0 h-auto text-blue-600"
              >
                View Full Text ({file.extractedText.length} characters)
              </Button>
            )}
          </div>
        </div>

        {/* Notes Section */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <StickyNote className="w-4 h-4 mr-2" />
            Notes ({file.notesCount || 0})
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddNote(!showAddNote)}
              className="ml-2 h-6 w-6 p-0"
            >
              <Plus className="w-3 h-3" />
            </Button>
          </h4>
          
          {file.notes && (
            <div className="bg-white border rounded-lg p-3 mb-2">
              <p className="text-sm">{file.notes}</p>
            </div>
          )}
          
          {!file.notes && !showAddNote && (
            <span className="text-sm text-gray-500 italic">No notes added</span>
          )}
          
          {showAddNote && (
            <div className="space-y-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note about this resume..."
                className="min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button onClick={handleAddNote} size="sm">
                  Add Note
                </Button>
                <Button 
                  onClick={() => setShowAddNote(false)} 
                  variant="ghost" 
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Processing Log */}
        {(file.retryCount > 0 || file.processingStatus === 'failed') && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              Processing Log
            </h4>
            <div className="bg-white border rounded-lg p-3 space-y-2 text-sm">
              <div className="flex items-center text-gray-600">
                <Calendar className="w-3 h-3 mr-2" />
                Uploaded: {formatDate(file.uploadedAt)}
              </div>
              {file.retryCount > 0 && (
                <div className="flex items-center text-yellow-600">
                  <RotateCcw className="w-3 h-3 mr-2" />
                  Retried {file.retryCount} time{file.retryCount > 1 ? 's' : ''}
                  {file.lastRetryAt && ` (last: ${formatDate(file.lastRetryAt)})`}
                </div>
              )}
              {file.processingStatus === 'failed' && (
                <div className="flex items-center text-red-600">
                  <AlertCircle className="w-3 h-3 mr-2" />
                  Processing failed - may need manual review
                </div>
              )}
              {file.processingStatus === 'completed' && (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="w-3 h-3 mr-2" />
                  Processing completed successfully
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Actions</h4>
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction('reprocess')}
              disabled={isLoading || file.processingStatus === 'processing'}
              className="flex items-center justify-center"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Re-process
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction('archive')}
              disabled={isLoading}
              className="flex items-center justify-center"
            >
              <Archive className="w-4 h-4 mr-2" />
              {file.isArchived ? 'Unarchive' : 'Archive'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction('export-text')}
              disabled={isLoading || !file.extractedText}
              className="flex items-center justify-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Text
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction('analyze')}
              disabled={isLoading || file.processingStatus !== 'completed'}
              className="flex items-center justify-center"
            >
              <Microscope className="w-4 h-4 mr-2" />
              Analyze
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(`File: ${file.fileName}\nSize: ${formatFileSize(file.fileSize)}\nStatus: ${file.processingStatus}\nUploaded: ${formatDate(file.uploadedAt)}`)}
              disabled={isLoading}
              className="flex items-center justify-center"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Details
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction('delete')}
              disabled={isLoading}
              className="flex items-center justify-center text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}