import { NextRequest, NextResponse } from 'next/server'
import { requireUserContext, checkUserQuota, logDataAccess } from '@/lib/security/user-context'
import { DataExportService } from '@/lib/services/data-export'
import { z } from 'zod'

const exportSchema = z.object({
  exportType: z.enum(['results', 'resumes', 'evaluations', 'all']),
  format: z.enum(['csv', 'json', 'excel']),
  filters: z.object({
    roleId: z.string().uuid().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    minScore: z.number().min(0).max(100).optional()
  }).optional()
})

export async function POST(request: NextRequest) {
  try {
    // Validate user context
    const userContext = await requireUserContext(request)
    
    // Parse and validate request body
    const body = await request.json()
    const validationResult = exportSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    }
    
    const { exportType, format, filters } = validationResult.data
    
    // Check user quota for exports (limit exports per month)
    const exportHistory = await DataExportService.getExportHistory(userContext.userId)
    const exportsThisMonth = exportHistory.filter(exp => {
      const exportDate = new Date(exp.created_at)
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      return exportDate > monthAgo
    }).length
    
    // Basic tier: 5 exports per month, Premium: 50, Enterprise: unlimited
    const exportLimits = {
      basic: 5,
      premium: 50,
      enterprise: 999999
    }
    
    const userLimit = exportLimits[userContext.subscriptionTier as keyof typeof exportLimits] || exportLimits.basic
    
    if (exportsThisMonth >= userLimit) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Export limit reached (${exportsThisMonth}/${userLimit} this month). Upgrade your plan for more exports.`
        },
        { status: 429 }
      )
    }
    
    // Log the export request
    await logDataAccess(
      userContext.userId,
      'EXPORT_DATA',
      exportType,
      'export_request',
      { format, filters }
    )
    
    // Perform the export
    const result = await DataExportService.exportUserData({
      userId: userContext.userId,
      exportType,
      format,
      filters: filters ? {
        roleId: filters.roleId,
        dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
        dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
        minScore: filters.minScore
      } : undefined
    })
    
    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: result.error || 'Export failed'
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: {
        downloadUrl: result.downloadUrl,
        fileName: result.fileName,
        expiresAt: result.expiresAt
      },
      message: `Export created successfully. Download link expires in 24 hours.`
    })
    
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to export data",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// GET /api/export - Get export history
export async function GET(request: NextRequest) {
  try {
    const userContext = await requireUserContext(request)
    
    const exportHistory = await DataExportService.getExportHistory(userContext.userId)
    
    return NextResponse.json({
      success: true,
      data: exportHistory,
      count: exportHistory.length
    })
    
  } catch (error) {
    console.error('Export history error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to fetch export history",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}