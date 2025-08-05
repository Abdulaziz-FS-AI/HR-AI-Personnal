import { NextRequest, NextResponse } from 'next/server'
import { addFileTag, removeFileTag } from '@/lib/db-resume-library'
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
    const body = await request.json()
    const { tagName } = body

    if (!tagName || typeof tagName !== 'string') {
      return NextResponse.json(
        { error: 'Tag name is required' },
        { status: 400 }
      )
    }

    const tagId = await addFileTag(fileId, tagName.trim(), session.user.id)

    if (!tagId) {
      return NextResponse.json(
        { error: 'Failed to add tag' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      tagId,
      message: 'Tag added successfully'
    })

  } catch (error) {
    console.error('Add tag error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileId } = await params
    const { searchParams } = new URL(request.url)
    const tagName = searchParams.get('tagName')

    if (!tagName) {
      return NextResponse.json(
        { error: 'Tag name is required' },
        { status: 400 }
      )
    }

    const success = await removeFileTag(fileId, tagName)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to remove tag' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Tag removed successfully'
    })

  } catch (error) {
    console.error('Remove tag error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}