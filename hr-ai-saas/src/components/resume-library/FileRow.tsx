"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { FileStatusBadge } from './FileStatusBadge'
import { FileDetailsExpanded } from './FileDetailsExpanded'
import { 
  Eye, 
  EyeOff, 
  MoreHorizontal, 
  FileText, 
  Microscope,
  Archive,
  Trash2,
  Download,
  RotateCcw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResumeFile } from '@/lib/db-resume-library'

interface FileRowProps {
  file: ResumeFile
  isSelected: boolean
  isExpanded: boolean
  isLoading: boolean
  onSelect: (selected: boolean) => void
  onToggleExpanded: () => void
  onAction: (action: string, data?: any) => void
}

export function FileRow({
  file,
  isSelected,
  isExpanded,
  isLoading,
  onSelect,
  onToggleExpanded,
  onAction
}: FileRowProps) {
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 48) return 'Yesterday'
    
    return date.toLocaleDateString()
  }

  const canQuickAnalyze = file.processingStatus === 'completed' && file.extractedText

  return (
    <>
      {/* Main Row */}
      <tr className={cn(
        "border-b hover:bg-gray-50 transition-colors",
        isSelected && "bg-blue-50",
        file.isArchived && "opacity-60"
      )}>
        {/* Checkbox */}
        <td className="w-12 px-4 py-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            disabled={isLoading}
          />
        </td>

        {/* File Icon */}
        <td className="w-12 px-2 py-3">
          <FileText className="w-5 h-5 text-gray-500" />
        </td>

        {/* File Name */}
        <td className="px-4 py-3">
          <div className="flex flex-col">
            <span className="font-medium text-gray-900 truncate max-w-[200px]">
              {file.fileName}
            </span>
            <div className="flex items-center space-x-2 mt-1">
              {file.tagList && (
                <div className="flex space-x-1">
                  {file.tagList.split(',').slice(0, 2).map((tag, index) => (
                    <span
                      key={index}
                      className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                    >
                      {tag.trim()}
                    </span>
                  ))}
                  {file.tagList.split(',').length > 2 && (
                    <span className="text-xs text-gray-500">
                      +{file.tagList.split(',').length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </td>

        {/* File Size */}
        <td className="px-4 py-3 text-sm text-gray-600">
          {formatFileSize(file.fileSize)}
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <FileStatusBadge 
            status={file.processingStatus} 
            confidence={file.extractionConfidence}
          />
        </td>

        {/* Upload Date */}
        <td className="px-4 py-3 text-sm text-gray-600">
          {formatDate(file.uploadedAt)}
        </td>

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center space-x-2">
            {/* Expand/Collapse Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpanded}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>

            {/* Quick Analyze Button */}
            {canQuickAnalyze && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAction('quick-analyze')}
                disabled={isLoading}
                className="h-8 w-8 p-0"
                title="Quick analyze with last used role"
              >
                <Microscope className="w-4 h-4 text-blue-600" />
              </Button>
            )}

            {/* More Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isLoading}
                  className="h-8 w-8 p-0"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onAction('export-text')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Text
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => onAction('analyze')}>
                  <Microscope className="w-4 h-4 mr-2" />
                  Analyze with Role
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {file.processingStatus === 'failed' && (
                  <DropdownMenuItem onClick={() => onAction('reprocess')}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retry Processing
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={() => onAction('archive')}>
                  <Archive className="w-4 h-4 mr-2" />
                  {file.isArchived ? 'Unarchive' : 'Archive'}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem 
                  onClick={() => onAction('delete')}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>

      {/* Expanded Details Row */}
      {isExpanded && (
        <tr>
          <td colSpan={7} className="px-0 py-0">
            <FileDetailsExpanded
              file={file}
              onAction={onAction}
              isLoading={isLoading}
            />
          </td>
        </tr>
      )}
    </>
  )
}