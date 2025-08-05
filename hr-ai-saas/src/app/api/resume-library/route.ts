import { NextRequest, NextResponse } from 'next/server'
import { getResumeFiles, bulkArchiveFiles, bulkDeleteFiles } from '@/lib/db-resume-library'

export async function GET(request: NextRequest) {
  try {
    // Use demo user ID since auth is bypassed
    const demoUserId = 'demo-user-123'

    const { searchParams } = new URL(request.url)
    
    // Parse filters
    const status = searchParams.get('status') as 'all' | 'ready' | 'processing' | 'failed' || 'all'
    const archived = searchParams.get('archived') === 'true'
    const search = searchParams.get('search') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    // Parse date range
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const dateRange = startDate && endDate ? {
      start: new Date(startDate),
      end: new Date(endDate)
    } : undefined

    // Parse tags
    const tagsParam = searchParams.get('tags')
    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()) : undefined

    const filters = {
      status,
      archived,
      search,
      dateRange,
      tags
    }

    const files = await getResumeFiles(demoUserId, filters, limit, offset)

    return NextResponse.json({
      success: true,
      files,
      pagination: {
        limit,
        offset,
        total: files.length
      }
    })

  } catch (error) {
    console.error('Get resume files error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Use demo user ID since auth is bypassed
    const demoUserId = 'demo-user-123'

    const body = await request.json()
    const { action, fileIds } = body

    if (!action || !fileIds || !Array.isArray(fileIds)) {
      return NextResponse.json(
        { error: 'Action and fileIds array are required' },
        { status: 400 }
      )
    }

    let affectedCount = 0

    switch (action) {
      case 'archive':
        affectedCount = await bulkArchiveFiles(fileIds, demoUserId)
        break
      
      case 'delete':
        affectedCount = await bulkDeleteFiles(fileIds, demoUserId)
        break
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: archive, delete' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      message: `${action} completed successfully`,
      affectedCount
    })

  } catch (error) {
    console.error('Bulk action error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}