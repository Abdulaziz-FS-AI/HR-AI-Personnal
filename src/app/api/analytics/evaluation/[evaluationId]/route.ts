/**
 * Advanced Analytics API - Evaluation Analytics Endpoint
 * Provides comprehensive evaluation analytics with AI insights
 */

import { NextRequest, NextResponse } from 'next/server'
import { analyticsEngine } from '@/lib/analytics/analytics-engine'

export async function GET(
  request: NextRequest,
  { params }: { params: { evaluationId: string } }
) {
  try {
    const { evaluationId } = params
    
    if (!evaluationId) {
      return NextResponse.json(
        { error: 'Evaluation ID is required' },
        { status: 400 }
      )
    }
    
    console.log(`Generating analytics for evaluation: ${evaluationId}`)
    
    // Generate comprehensive analytics
    const analytics = await analyticsEngine.generateAnalytics(evaluationId)
    
    return NextResponse.json({
      success: true,
      data: analytics,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '2.0',
        analyticsEngine: 'Advanced'
      }
    })
    
  } catch (error) {
    console.error('Analytics generation error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { evaluationId: string } }
) {
  try {
    const { evaluationId } = params
    const body = await request.json()
    const { forceRefresh = false } = body
    
    if (!evaluationId) {
      return NextResponse.json(
        { error: 'Evaluation ID is required' },
        { status: 400 }
      )
    }
    
    console.log(`Refreshing analytics for evaluation: ${evaluationId}`)
    
    // Always regenerate analytics on POST
    const analytics = await analyticsEngine.generateAnalytics(evaluationId)
    
    return NextResponse.json({
      success: true,
      data: analytics,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '2.0',
        analyticsEngine: 'Advanced',
        refreshed: true
      }
    })
    
  } catch (error) {
    console.error('Analytics refresh error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to refresh analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}