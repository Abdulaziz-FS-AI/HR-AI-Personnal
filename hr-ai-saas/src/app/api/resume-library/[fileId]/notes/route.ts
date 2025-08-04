import { NextRequest, NextResponse } from 'next/server'
import { addFileNote, getFileNotes } from '@/lib/db-resume-library'
import { auth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileId } = await params
    const notes = await getFileNotes(fileId)

    return NextResponse.json({
      success: true,
      notes
    })

  } catch (error) {
    console.error('Get notes error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

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
    const body = await request.json()
    const { noteText } = body

    if (!noteText || typeof noteText !== 'string') {
      return NextResponse.json(
        { error: 'Note text is required' },
        { status: 400 }
      )
    }

    const noteId = await addFileNote(fileId, session.user.id, noteText.trim())

    if (!noteId) {
      return NextResponse.json(
        { error: 'Failed to add note' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      noteId,
      message: 'Note added successfully'
    })

  } catch (error) {
    console.error('Add note error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}