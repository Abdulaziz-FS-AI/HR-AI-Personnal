import { NextRequest, NextResponse } from 'next/server'
import { reprocessFile } from '@/lib/db-resume-library'
import { pdfProcessor } from '@/lib/azure/pdf-processor'
import { auth } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileId } = await params

    // Update database status to pending for reprocessing
    const updateSuccess = await reprocessFile(fileId, session.user.id)

    if (!updateSuccess) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      )
    }

    // Queue for background processing
    // In a production environment, you'd queue this for background processing
    // For now, we'll just update the status and let the existing processor handle it
    
    return NextResponse.json({
      success: true,
      message: 'File queued for reprocessing'
    })

  } catch (error) {
    console.error('Reprocess file error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}