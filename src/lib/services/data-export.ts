import { getUserResults, getUserFiles, getUserRoles, getUserEvaluations } from '@/lib/db-secure'
import { getBlobStorageService } from '@/lib/azure/blob-storage'
import sql from 'mssql'
import { getDbConnection } from '@/lib/db'
import * as XLSX from 'xlsx'
import { Parser } from 'json2csv'

export interface ExportOptions {
  userId: string
  exportType: 'results' | 'resumes' | 'evaluations' | 'all'
  format: 'csv' | 'json' | 'excel'
  filters?: {
    roleId?: string
    dateFrom?: Date
    dateTo?: Date
    minScore?: number
  }
}

export interface ExportResult {
  success: boolean
  downloadUrl?: string
  fileName?: string
  expiresAt?: Date
  error?: string
}

export class DataExportService {
  /**
   * Export user data in the requested format
   */
  static async exportUserData(options: ExportOptions): Promise<ExportResult> {
    try {
      let data: any = {}
      
      // Gather data based on export type
      switch (options.exportType) {
        case 'results':
          data.results = await getUserResults(options.userId, {
            roleId: options.filters?.roleId,
            minScore: options.filters?.minScore
          })
          break
          
        case 'resumes':
          data.files = await getUserFiles(options.userId, {
            roleId: options.filters?.roleId
          })
          break
          
        case 'evaluations':
          data.evaluations = await getUserEvaluations(options.userId)
          for (const evaluation of data.evaluations) {
            evaluation.results = await getUserResults(options.userId, {
              sessionId: evaluation.id
            })
          }
          break
          
        case 'all':
          data.roles = await getUserRoles(options.userId)
          data.files = await getUserFiles(options.userId)
          data.evaluations = await getUserEvaluations(options.userId)
          data.results = await getUserResults(options.userId)
          break
      }
      
      // Convert to requested format
      let exportContent: Buffer
      let fileName: string
      let contentType: string
      
      const timestamp = new Date().toISOString().split('T')[0]
      
      switch (options.format) {
        case 'csv':
          exportContent = await this.convertToCSV(data, options.exportType)
          fileName = `export-${options.exportType}-${timestamp}.csv`
          contentType = 'text/csv'
          break
          
        case 'json':
          exportContent = Buffer.from(JSON.stringify(data, null, 2))
          fileName = `export-${options.exportType}-${timestamp}.json`
          contentType = 'application/json'
          break
          
        case 'excel':
          exportContent = await this.convertToExcel(data, options.exportType)
          fileName = `export-${options.exportType}-${timestamp}.xlsx`
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          break
          
        default:
          throw new Error(`Unsupported format: ${options.format}`)
      }
      
      // Upload to blob storage
      const blobService = getBlobStorageService()
      const blobName = `exports/${options.userId}/${fileName}`
      
      // Generate download URL (expires in 24 hours)
      const downloadUrl = await blobService.generateDownloadUrl(blobName, 24)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      
      // Log export in database
      await this.logExport(options.userId, options.exportType, options.format, exportContent.length, downloadUrl, expiresAt)
      
      return {
        success: true,
        downloadUrl,
        fileName,
        expiresAt
      }
      
    } catch (error) {
      console.error('Export error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      }
    }
  }
  
  /**
   * Convert data to CSV format
   */
  private static async convertToCSV(data: any, exportType: string): Promise<Buffer> {
    let csvContent = ''
    
    switch (exportType) {
      case 'results':
        if (data.results?.length > 0) {
          const fields = [
            'id', 'role_title', 'original_filename', 'overall_score',
            'summary', 'recommendations', 'red_flags', 'created_at'
          ]
          const parser = new Parser({ fields })
          csvContent = parser.parse(data.results)
        }
        break
        
      case 'resumes':
        if (data.files?.length > 0) {
          const fields = [
            'id', 'original_filename', 'file_size', 'upload_status',
            'processing_status', 'created_at'
          ]
          const parser = new Parser({ fields })
          csvContent = parser.parse(data.files)
        }
        break
        
      case 'evaluations':
        // Flatten evaluations with results
        const flatData: any[] = []
        for (const evaluation of data.evaluations || []) {
          for (const result of evaluation.results || []) {
            flatData.push({
              evaluation_id: evaluation.id,
              evaluation_status: evaluation.status,
              ...result
            })
          }
        }
        if (flatData.length > 0) {
          const parser = new Parser()
          csvContent = parser.parse(flatData)
        }
        break
        
      case 'all':
        // Create multiple CSV sections
        const sections = []
        
        if (data.roles?.length > 0) {
          sections.push('=== ROLES ===')
          const rolesParser = new Parser()
          sections.push(rolesParser.parse(data.roles))
        }
        
        if (data.files?.length > 0) {
          sections.push('\n=== FILES ===')
          const filesParser = new Parser()
          sections.push(filesParser.parse(data.files))
        }
        
        if (data.results?.length > 0) {
          sections.push('\n=== RESULTS ===')
          const resultsParser = new Parser()
          sections.push(resultsParser.parse(data.results))
        }
        
        csvContent = sections.join('\n')
        break
    }
    
    return Buffer.from(csvContent)
  }
  
  /**
   * Convert data to Excel format
   */
  private static async convertToExcel(data: any, exportType: string): Promise<Buffer> {
    const workbook = XLSX.utils.book_new()
    
    switch (exportType) {
      case 'results':
        if (data.results?.length > 0) {
          const worksheet = XLSX.utils.json_to_sheet(data.results)
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Results')
        }
        break
        
      case 'resumes':
        if (data.files?.length > 0) {
          const worksheet = XLSX.utils.json_to_sheet(data.files)
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumes')
        }
        break
        
      case 'evaluations':
        if (data.evaluations?.length > 0) {
          const evalSheet = XLSX.utils.json_to_sheet(data.evaluations.map((e: any) => ({
            ...e,
            results: undefined // Remove nested results for main sheet
          })))
          XLSX.utils.book_append_sheet(workbook, evalSheet, 'Evaluations')
          
          // Add results in separate sheet
          const allResults: any[] = []
          for (const evaluation of data.evaluations) {
            for (const result of evaluation.results || []) {
              allResults.push({
                evaluation_id: evaluation.id,
                ...result
              })
            }
          }
          if (allResults.length > 0) {
            const resultsSheet = XLSX.utils.json_to_sheet(allResults)
            XLSX.utils.book_append_sheet(workbook, resultsSheet, 'Evaluation Results')
          }
        }
        break
        
      case 'all':
        // Create separate sheets for each data type
        if (data.roles?.length > 0) {
          const rolesSheet = XLSX.utils.json_to_sheet(data.roles)
          XLSX.utils.book_append_sheet(workbook, rolesSheet, 'Roles')
        }
        
        if (data.files?.length > 0) {
          const filesSheet = XLSX.utils.json_to_sheet(data.files)
          XLSX.utils.book_append_sheet(workbook, filesSheet, 'Files')
        }
        
        if (data.evaluations?.length > 0) {
          const evalsSheet = XLSX.utils.json_to_sheet(data.evaluations)
          XLSX.utils.book_append_sheet(workbook, evalsSheet, 'Evaluations')
        }
        
        if (data.results?.length > 0) {
          const resultsSheet = XLSX.utils.json_to_sheet(data.results)
          XLSX.utils.book_append_sheet(workbook, resultsSheet, 'Results')
        }
        break
    }
    
    // Write workbook to buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    return Buffer.from(excelBuffer)
  }
  
  /**
   * Log export in database
   */
  private static async logExport(
    userId: string,
    exportType: string,
    format: string,
    fileSize: number,
    downloadUrl: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      const pool = await getDbConnection()
      await pool.request()
        .input('userId', sql.UniqueIdentifier, userId)
        .input('exportType', sql.NVarChar, exportType)
        .input('format', sql.NVarChar, format)
        .input('fileCount', sql.Int, 1)
        .input('fileSizeMb', sql.Decimal(10, 2), fileSize / 1048576)
        .input('downloadUrl', sql.NVarChar, downloadUrl)
        .input('expiresAt', sql.DateTime2, expiresAt)
        .query(`
          INSERT INTO export_logs (user_id, export_type, format, file_count, file_size_mb, download_url, expires_at)
          VALUES (@userId, @exportType, @format, @fileCount, @fileSizeMb, @downloadUrl, @expiresAt)
        `)
    } catch (error) {
      console.error('Failed to log export:', error)
    }
  }
  
  /**
   * Get user's export history
   */
  static async getExportHistory(userId: string): Promise<any[]> {
    try {
      const pool = await getDbConnection()
      const result = await pool.request()
        .input('userId', sql.UniqueIdentifier, userId)
        .query(`
          SELECT * FROM export_logs 
          WHERE user_id = @userId 
          ORDER BY created_at DESC
        `)
      return result.recordset
    } catch (error) {
      console.error('Failed to get export history:', error)
      return []
    }
  }
}