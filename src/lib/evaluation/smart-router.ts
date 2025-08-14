/**
 * Smart Router for Evaluation Processing
 * Intelligently routes evaluation requests based on workload, system health, and performance requirements
 */

import { ServiceBusClient, ServiceBusMessage } from '@azure/service-bus'
import { EvaluationAnalyzer } from '@/lib/ai/evaluation-analyzer'
import { createEvaluationResult, updateEvaluationStatus } from '@/lib/db-secure'
import { pdfTextExtractor } from '@/lib/services/pdf-text-extractor'

export enum ProcessingMode {
  DIRECT = 'direct',        // < 10 files: Synchronous processing
  HYBRID = 'hybrid',        // 10-50 files: Queue with polling
  ASYNC = 'async',          // > 50 files: Full async with notifications
  EMERGENCY = 'emergency'   // Fallback mode when Azure is down
}

export interface ProcessingStrategy {
  mode: ProcessingMode
  estimatedTime: number // in seconds
  requiresQueue: boolean
  requiresNotification: boolean
  maxConcurrency: number
  timeoutSeconds: number
}

export interface EvaluationRequest {
  evaluationId: string
  roleId: string
  userId: string
  files: Array<{
    id: string
    content: Buffer | string
    filename: string
  }>
  priority?: 'low' | 'normal' | 'high' | 'critical'
  metadata?: Record<string, any>
}

export interface ProcessingResult {
  success: boolean
  mode: ProcessingMode
  processedCount: number
  failedCount: number
  errors: Array<{ fileId: string; error: string }>
  estimatedCompletionTime?: Date
  queueMessageId?: string
}

class SmartEvaluationRouter {
  private serviceBusClient: ServiceBusClient | null = null
  private evaluationAnalyzer: EvaluationAnalyzer
  private isAzureHealthy: boolean = true
  private lastHealthCheck: Date = new Date()
  private processingMetrics = {
    directSuccess: 0,
    directFailure: 0,
    queueSuccess: 0,
    queueFailure: 0,
    avgDirectTime: 0,
    avgQueueTime: 0
  }

  constructor() {
    this.evaluationAnalyzer = new EvaluationAnalyzer()
    this.initializeServiceBus()
    this.startHealthMonitoring()
  }

  /**
   * Initialize Service Bus connection with retry logic
   */
  private async initializeServiceBus(): Promise<void> {
    try {
      const connectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING
      if (connectionString) {
        this.serviceBusClient = new ServiceBusClient(connectionString)
        console.log('✅ Service Bus connected successfully')
      } else {
        console.warn('⚠️ Service Bus connection string not found, running in degraded mode')
      }
    } catch (error) {
      console.error('❌ Failed to connect to Service Bus:', error)
      this.isAzureHealthy = false
    }
  }

  /**
   * Health monitoring for Azure services
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      await this.checkAzureHealth()
    }, 30000) // Check every 30 seconds
  }

  /**
   * Check Azure Service Bus health
   */
  private async checkAzureHealth(): Promise<boolean> {
    if (!this.serviceBusClient) {
      this.isAzureHealthy = false
      return false
    }

    try {
      // Try to create a sender as a health check
      const sender = this.serviceBusClient.createSender('evaluation-queue')
      await sender.close()
      this.isAzureHealthy = true
      this.lastHealthCheck = new Date()
      return true
    } catch (error) {
      console.error('❌ Azure health check failed:', error)
      this.isAzureHealthy = false
      return false
    }
  }

  /**
   * Determine the best processing strategy based on current conditions
   */
  public determineStrategy(request: EvaluationRequest): ProcessingStrategy {
    const fileCount = request.files.length
    const priority = request.priority || 'normal'
    const azureAvailable = this.isAzureHealthy && this.serviceBusClient !== null

    // Emergency mode if Azure is down
    if (!azureAvailable && fileCount > 20) {
      return {
        mode: ProcessingMode.EMERGENCY,
        estimatedTime: fileCount * 3, // 3 seconds per file
        requiresQueue: false,
        requiresNotification: false,
        maxConcurrency: 2, // Limited concurrency in emergency
        timeoutSeconds: 600 // 10 minutes max
      }
    }

    // Critical priority always uses direct mode if possible
    if (priority === 'critical' && fileCount <= 20) {
      return {
        mode: ProcessingMode.DIRECT,
        estimatedTime: fileCount * 2,
        requiresQueue: false,
        requiresNotification: false,
        maxConcurrency: 5,
        timeoutSeconds: 300
      }
    }

    // Standard routing based on file count
    if (fileCount <= 10) {
      return {
        mode: ProcessingMode.DIRECT,
        estimatedTime: fileCount * 2, // 2 seconds per file
        requiresQueue: false,
        requiresNotification: false,
        maxConcurrency: 5,
        timeoutSeconds: 120 // 2 minutes
      }
    } else if (fileCount <= 50) {
      return {
        mode: ProcessingMode.HYBRID,
        estimatedTime: fileCount * 1.5, // 1.5 seconds per file with queue
        requiresQueue: azureAvailable,
        requiresNotification: false,
        maxConcurrency: 10,
        timeoutSeconds: 300 // 5 minutes
      }
    } else {
      return {
        mode: ProcessingMode.ASYNC,
        estimatedTime: fileCount * 1, // 1 second per file in full async
        requiresQueue: true,
        requiresNotification: true,
        maxConcurrency: 20,
        timeoutSeconds: 0 // No timeout for async
      }
    }
  }

  /**
   * Main routing function - directs evaluation to appropriate processor
   */
  public async processEvaluation(request: EvaluationRequest): Promise<ProcessingResult> {
    const strategy = this.determineStrategy(request)
    
    console.log(`📊 Processing ${request.files.length} files using ${strategy.mode} mode`)
    console.log(`⏱️ Estimated time: ${strategy.estimatedTime} seconds`)

    // Log metrics
    this.logProcessingStart(request, strategy)

    try {
      switch (strategy.mode) {
        case ProcessingMode.DIRECT:
          return await this.processDirectly(request, strategy)
        
        case ProcessingMode.HYBRID:
          return await this.processHybrid(request, strategy)
        
        case ProcessingMode.ASYNC:
          return await this.processAsync(request, strategy)
        
        case ProcessingMode.EMERGENCY:
          return await this.processEmergency(request, strategy)
        
        default:
          throw new Error(`Unknown processing mode: ${strategy.mode}`)
      }
    } catch (error) {
      console.error('❌ Processing failed:', error)
      
      // Fallback to emergency mode if primary strategy fails
      if (strategy.mode !== ProcessingMode.EMERGENCY) {
        console.log('🚨 Falling back to emergency mode')
        return await this.processEmergency(request, {
          ...strategy,
          mode: ProcessingMode.EMERGENCY
        })
      }
      
      throw error
    }
  }

  /**
   * Direct processing - for small batches
   */
  private async processDirectly(
    request: EvaluationRequest, 
    strategy: ProcessingStrategy
  ): Promise<ProcessingResult> {
    const startTime = Date.now()
    const errors: Array<{ fileId: string; error: string }> = []
    let processedCount = 0
    let failedCount = 0

    // Process files with controlled concurrency
    const chunks = this.chunkArray(request.files, strategy.maxConcurrency)
    
    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(file => this.processSingleFile(file, request.roleId, request.evaluationId))
      )

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          processedCount++
        } else {
          failedCount++
          errors.push({
            fileId: chunk[index].id,
            error: result.status === 'rejected' 
              ? result.reason?.message || 'Unknown error'
              : result.value?.error || 'Processing failed'
          })
        }
      })
    }

    const processingTime = Date.now() - startTime
    this.updateMetrics('direct', processedCount > 0, processingTime)

    return {
      success: failedCount === 0,
      mode: ProcessingMode.DIRECT,
      processedCount,
      failedCount,
      errors,
      estimatedCompletionTime: new Date()
    }
  }

  /**
   * Hybrid processing - queue with immediate polling
   */
  private async processHybrid(
    request: EvaluationRequest,
    strategy: ProcessingStrategy
  ): Promise<ProcessingResult> {
    // If queue is available, use it
    if (strategy.requiresQueue && this.serviceBusClient) {
      const queueResult = await this.sendToQueue(request, 'high')
      
      if (queueResult.success) {
        // Start processing first batch directly while rest goes to queue
        const immediateFiles = request.files.slice(0, 5)
        const directResult = await this.processDirectly(
          { ...request, files: immediateFiles },
          { ...strategy, maxConcurrency: 3 }
        )

        return {
          ...queueResult,
          mode: ProcessingMode.HYBRID,
          processedCount: directResult.processedCount,
          estimatedCompletionTime: new Date(Date.now() + strategy.estimatedTime * 1000)
        }
      }
    }

    // Fallback to direct processing if queue fails
    return await this.processDirectly(request, strategy)
  }

  /**
   * Async processing - full queue with notifications
   */
  private async processAsync(
    request: EvaluationRequest,
    strategy: ProcessingStrategy
  ): Promise<ProcessingResult> {
    if (!this.serviceBusClient) {
      console.warn('⚠️ Service Bus not available, falling back to hybrid mode')
      return await this.processHybrid(request, { ...strategy, mode: ProcessingMode.HYBRID })
    }

    const queueResult = await this.sendToQueue(request, 'normal')
    
    if (queueResult.success) {
      // Update evaluation status to processing
      await updateEvaluationStatus(request.evaluationId, 'processing')
      
      // Schedule notification
      if (strategy.requiresNotification) {
        await this.scheduleNotification(request, strategy.estimatedTime)
      }

      return {
        ...queueResult,
        mode: ProcessingMode.ASYNC,
        estimatedCompletionTime: new Date(Date.now() + strategy.estimatedTime * 1000)
      }
    }

    // Fallback to hybrid if queue fails
    return await this.processHybrid(request, { ...strategy, mode: ProcessingMode.HYBRID })
  }

  /**
   * Emergency processing - when Azure is down
   */
  private async processEmergency(
    request: EvaluationRequest,
    strategy: ProcessingStrategy
  ): Promise<ProcessingResult> {
    console.log('🚨 Running in emergency mode - limited capacity')
    
    // Process with very limited concurrency to avoid overwhelming the system
    const emergencyStrategy = {
      ...strategy,
      maxConcurrency: 2,
      timeoutSeconds: 600
    }

    // Process in small batches with delays
    const errors: Array<{ fileId: string; error: string }> = []
    let processedCount = 0
    let failedCount = 0

    const chunks = this.chunkArray(request.files, 2) // Process 2 at a time
    
    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(file => this.processSingleFile(file, request.roleId, request.evaluationId))
      )

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          processedCount++
        } else {
          failedCount++
          errors.push({
            fileId: chunk[index].id,
            error: 'Emergency processing failed'
          })
        }
      })

      // Add delay between batches to prevent overload
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return {
      success: failedCount < request.files.length / 2, // Consider success if more than half processed
      mode: ProcessingMode.EMERGENCY,
      processedCount,
      failedCount,
      errors
    }
  }

  /**
   * Send evaluation to Azure Service Bus queue
   */
  private async sendToQueue(
    request: EvaluationRequest, 
    priority: string
  ): Promise<ProcessingResult> {
    if (!this.serviceBusClient) {
      return {
        success: false,
        mode: ProcessingMode.ASYNC,
        processedCount: 0,
        failedCount: request.files.length,
        errors: [{ fileId: 'all', error: 'Service Bus not available' }]
      }
    }

    try {
      const sender = this.serviceBusClient.createSender('evaluation-queue')
      
      const message: ServiceBusMessage = {
        body: {
          evaluationId: request.evaluationId,
          roleId: request.roleId,
          userId: request.userId,
          files: request.files.map(f => ({
            id: f.id,
            filename: f.filename,
            size: Buffer.isBuffer(f.content) ? f.content.length : f.content.length
          })),
          priority: request.priority || 'normal',
          metadata: request.metadata,
          timestamp: new Date().toISOString()
        },
        contentType: 'application/json',
        subject: 'evaluation-processing',
        messageId: `eval-${request.evaluationId}-${Date.now()}`,
        sessionId: request.evaluationId,
        partitionKey: request.userId,
        timeToLive: 3600000, // 1 hour
        scheduledEnqueueTimeUtc: priority === 'low' 
          ? new Date(Date.now() + 60000) // Delay low priority by 1 minute
          : new Date()
      }

      await sender.sendMessages(message)
      await sender.close()

      console.log(`✅ Queued evaluation ${request.evaluationId} with ${request.files.length} files`)

      return {
        success: true,
        mode: ProcessingMode.ASYNC,
        processedCount: 0,
        failedCount: 0,
        errors: [],
        queueMessageId: message.messageId
      }
    } catch (error) {
      console.error('❌ Failed to queue evaluation:', error)
      return {
        success: false,
        mode: ProcessingMode.ASYNC,
        processedCount: 0,
        failedCount: request.files.length,
        errors: [{ 
          fileId: 'all', 
          error: error instanceof Error ? error.message : 'Queue submission failed' 
        }]
      }
    }
  }

  /**
   * Process a single file
   */
  private async processSingleFile(
    file: { id: string; content: Buffer | string; filename: string },
    roleId: string,
    evaluationId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Extract text if needed
      let text: string
      if (Buffer.isBuffer(file.content)) {
        const extraction = await pdfTextExtractor.extractText(file.content)
        text = extraction.text
      } else {
        text = file.content
      }

      // Analyze with AI
      const analysis = await this.evaluationAnalyzer.analyzeResume(
        text,
        roleId,
        [],  // Skills will be loaded from DB
        []   // Questions will be loaded from DB
      )

      // Save result
      await createEvaluationResult({
        evaluationId,
        fileId: file.id,
        filename: file.filename,
        overallScore: analysis.overallScore,
        skillsAnalysis: analysis.skillsAnalysis,
        questionsAnalysis: analysis.questionsAnalysis,
        recommendations: analysis.recommendations,
        redFlags: analysis.redFlags,
        extractedText: text
      })

      return { success: true }
    } catch (error) {
      console.error(`Failed to process file ${file.id}:`, error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Processing failed' 
      }
    }
  }

  /**
   * Schedule notification for async processing
   */
  private async scheduleNotification(
    request: EvaluationRequest,
    estimatedSeconds: number
  ): Promise<void> {
    // This would integrate with your notification system
    console.log(`📧 Notification scheduled for evaluation ${request.evaluationId} in ${estimatedSeconds} seconds`)
  }

  /**
   * Utility: Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  /**
   * Log processing start for metrics
   */
  private logProcessingStart(request: EvaluationRequest, strategy: ProcessingStrategy): void {
    console.log('📊 Processing Metrics:', {
      evaluationId: request.evaluationId,
      fileCount: request.files.length,
      mode: strategy.mode,
      estimatedTime: strategy.estimatedTime,
      azureHealth: this.isAzureHealthy,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Update processing metrics
   */
  private updateMetrics(mode: 'direct' | 'queue', success: boolean, timeMs: number): void {
    if (mode === 'direct') {
      if (success) {
        this.processingMetrics.directSuccess++
      } else {
        this.processingMetrics.directFailure++
      }
      // Update rolling average
      this.processingMetrics.avgDirectTime = 
        (this.processingMetrics.avgDirectTime + timeMs) / 2
    } else {
      if (success) {
        this.processingMetrics.queueSuccess++
      } else {
        this.processingMetrics.queueFailure++
      }
      this.processingMetrics.avgQueueTime = 
        (this.processingMetrics.avgQueueTime + timeMs) / 2
    }
  }

  /**
   * Get current processing metrics
   */
  public getMetrics() {
    return {
      ...this.processingMetrics,
      azureHealthy: this.isAzureHealthy,
      lastHealthCheck: this.lastHealthCheck
    }
  }

  /**
   * Cleanup resources
   */
  public async dispose(): Promise<void> {
    if (this.serviceBusClient) {
      await this.serviceBusClient.close()
    }
  }
}

// Export singleton instance
export const smartRouter = new SmartEvaluationRouter()

// Export types
export type { EvaluationRequest, ProcessingResult, ProcessingStrategy }