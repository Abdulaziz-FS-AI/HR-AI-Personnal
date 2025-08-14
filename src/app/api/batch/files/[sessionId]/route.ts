import { NextRequest, NextResponse } from 'next/server'
import { requireUserContext } from '@/lib/security/user-context'
import { getBatchSessionFiles } from '@/lib/db-files'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    // Secure user context validation
    const userContext = await requireUserContext(request)
    const sessionId = params.sessionId

    // Get batch session files
    const files = await getBatchSessionFiles(sessionId)

    // Simple ownership check - files should belong to user
    if (files.length > 0 && files[0].userId !== userContext.userId) {
      return NextResponse.json(
        { success: false, message: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: files.map(file => ({
        id: file.id,
        filename: file.originalFilename,
        status: file.processingStatus,
        progress: file.processingStatus === 'completed' ? 100 : 
                 file.processingStatus === 'processing' ? 50 : 0,
        score: file.aiScore,
        error: file.processingStatus === 'failed' ? 'Processing failed' : undefined
      }))
    })

  } catch (error) {
    console.error('Error fetching batch files:', error)
    
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch batch files',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}