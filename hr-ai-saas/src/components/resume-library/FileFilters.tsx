"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Filter, 
  X, 
  Calendar as CalendarIcon,
  RotateCcw,
  Tag
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import type { FileFilters } from '@/lib/db-resume-library'

interface FileFiltersProps {
  filters: FileFilters
  onFiltersChange: (filters: FileFilters) => void
  totalFiles: number
  filteredFiles: number
}

export function FileFilters({ 
  filters, 
  onFiltersChange, 
  totalFiles, 
  filteredFiles 
}: FileFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search || '')
  const [tagInput, setTagInput] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const updateFilters = (updates: Partial<FileFilters>) => {
    onFiltersChange({ ...filters, ...updates })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ search: searchInput.trim() || undefined })
  }

  const addTag = () => {
    if (tagInput.trim()) {
      const currentTags = filters.tags || []
      if (!currentTags.includes(tagInput.trim())) {
        updateFilters({ 
          tags: [...currentTags, tagInput.trim()] 
        })
      }
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    const currentTags = filters.tags || []
    updateFilters({ 
      tags: currentTags.filter(tag => tag !== tagToRemove) 
    })
  }

  const clearAllFilters = () => {
    setSearchInput('')
    setTagInput('')
    onFiltersChange({})
  }

  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key as keyof FileFilters]
    return value !== undefined && value !== null && value !== ''
  })

  return (
    <div className="bg-white border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold">Filters</h3>
          {hasActiveFilters && (
            <Badge variant="secondary">
              {filteredFiles} of {totalFiles} files
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Simple' : 'Advanced'}
          </Button>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Basic Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="md:col-span-2">
          <Label htmlFor="search">Search</Label>
          <form onSubmit={handleSearchSubmit} className="flex space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search files, content, or tags..."
                className="pl-10"
              />
            </div>
            <Button type="submit" size="sm">
              Search
            </Button>
          </form>
        </div>

        {/* Status Filter */}
        <div>
          <Label>Status</Label>
          <Select
            value={filters.status || 'all'}
            onValueChange={(value) => 
              updateFilters({ status: value === 'all' ? undefined : value as any })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Files</SelectItem>
              <SelectItem value="ready">Ready for Analysis</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Archive Filter */}
        <div>
          <Label>Archive Status</Label>
          <Select
            value={filters.archived === undefined ? 'all' : filters.archived ? 'archived' : 'active'}
            onValueChange={(value) => 
              updateFilters({ 
                archived: value === 'all' ? undefined : value === 'archived' 
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All files" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Files</SelectItem>
              <SelectItem value="active">Active Files</SelectItem>
              <SelectItem value="archived">Archived Files</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="border-t pt-4 space-y-4">
          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Upload Date From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.dateRange?.start && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateRange?.start ? (
                      format(filters.dateRange.start, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange?.start}
                    onSelect={(date) => 
                      updateFilters({
                        dateRange: date ? {
                          start: date,
                          end: filters.dateRange?.end || new Date()
                        } : undefined
                      })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Upload Date To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.dateRange?.end && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateRange?.end ? (
                      format(filters.dateRange.end, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateRange?.end}
                    onSelect={(date) => 
                      updateFilters({
                        dateRange: date ? {
                          start: filters.dateRange?.start || new Date(),
                          end: date
                        } : undefined
                      })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Tags Filter */}
          <div>
            <Label>Filter by Tags</Label>
            <div className="space-y-2">
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add tag filter..."
                    className="pl-10"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                </div>
                <Button onClick={addTag} size="sm" disabled={!tagInput.trim()}>
                  Add
                </Button>
              </div>
              
              {filters.tags && filters.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {filters.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTag(tag)}
                        className="h-4 w-4 p-0 hover:bg-transparent"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {filteredFiles} of {totalFiles} files
            </span>
            <div className="flex items-center space-x-4">
              {filters.search && (
                <span>Search: &quot;{filters.search}&quot;</span>
              )}
              {filters.status && filters.status !== 'all' && (
                <span>Status: {filters.status}</span>
              )}
              {filters.archived !== undefined && (
                <span>{filters.archived ? 'Archived' : 'Active'} files only</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}