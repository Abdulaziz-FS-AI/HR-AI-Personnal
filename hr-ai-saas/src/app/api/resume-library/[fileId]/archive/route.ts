import { NextRequest, NextResponse } from 'next/server'
import { archiveResumeFile } from '@/lib/db-resume-library'
import { auth } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileId } = await params
    const body = await request.json()
    const { archive = true } = body

    const success = await archiveResumeFile(fileId, session.user.id, archive)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update file archive status' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: archive ? 'File archived successfully' : 'File unarchived successfully'
    })

  } catch (error) {
    console.error('Archive file error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}