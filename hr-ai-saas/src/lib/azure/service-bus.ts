import { ServiceBusClient, ServiceBusMessage, ServiceBusSender, ServiceBusReceiver } from '@azure/service-bus'

interface ServiceBusConfig {
  connectionString: string
  queueNames: {
    fileProcessing: string
    aiAnalysis: string
    resultsAggregation: string
  }
}

interface FileProcessingMessage {
  fileId: string
  userId: string
  roleId?: string
  sessionId: string
  blobName: string
  fileName: string
  priority: number
  retryCount?: number
}

interface AIAnalysisMessage {
  fileId: string
  userId: string
  roleId: string
  sessionId: string
  extractedText: string
  roleSkills: Array<{ skillName: string; weight: number; isRequired: boolean }>
  roleQuestions: Array<{ questionText: string; weight: number }>
  priority: number
  retryCount?: number
}

interface ResultsAggregationMessage {
  sessionId: string
  userId: string
  roleId: string
  totalFiles: number
  completedFiles: number
}

class ServiceBusService {
  private client: ServiceBusClient
  private config: ServiceBusConfig
  private senders: Map<string, ServiceBusSender> = new Map()

  constructor() {
    this.config = {
      connectionString: process.env.AZURE_SERVICE_BUS_CONNECTION_STRING || '',
      queueNames: {
        fileProcessing: 'file-processing',
        aiAnalysis: 'ai-analysis', 
        resultsAggregation: 'results-aggregation'
      }
    }

    if (!this.config.connectionString) {
      throw new Error('Azure Service Bus connection string not configured')
    }

    this.client = new ServiceBusClient(this.config.connectionString)
  }

  /**
   * Get or create a sender for a specific queue
   */
  private async getSender(queueName: string): Promise<ServiceBusSender> {
    if (!this.senders.has(queueName)) {
      const sender = this.client.createSender(queueName)
      this.senders.set(queueName, sender)
    }
    return this.senders.get(queueName)!
  }

  /**
   * Send file for processing (PDF extraction)
   */
  async queueFileForProcessing(message: FileProcessingMessage): Promise<void> {
    try {
      const sender = await this.getSender(this.config.queueNames.fileProcessing)
      
      const serviceBusMessage: ServiceBusMessage = {
        body: message,
        messageId: `file-${message.fileId}-${Date.now()}`,
        contentType: 'application/json',
        subject: 'file-processing',
        applicationProperties: {
          fileId: message.fileId,
          userId: message.userId,
          sessionId: message.sessionId,
          priority: message.priority,
          retryCount: message.retryCount || 0
        },
        timeToLive: 24 * 60 * 60 * 1000, // 24 hours
        scheduledEnqueueTime: message.priority >= 8 ? undefined : new Date(Date.now() + 5000) // High priority files processed immediately
      }

      await sender.sendMessages(serviceBusMessage)
      console.log(`File ${message.fileId} queued for processing`)
    } catch (error) {
      console.error('Error queueing file for processing:', error)
      throw new Error(`Failed to queue file for processing: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Send extracted text for AI analysis
   */
  async queueForAIAnalysis(message: AIAnalysisMessage): Promise<void> {
    try {
      const sender = await this.getSender(this.config.queueNames.aiAnalysis)
      
      const serviceBusMessage: ServiceBusMessage = {
        body: message,
        messageId: `ai-${message.fileId}-${Date.now()}`,
        contentType: 'application/json',
        subject: 'ai-analysis',
        applicationProperties: {
          fileId: message.fileId,
          userId: message.userId,
          roleId: message.roleId,
          sessionId: message.sessionId,
          priority: message.priority,
          retryCount: message.retryCount || 0
        },
        timeToLive: 12 * 60 * 60 * 1000, // 12 hours
        scheduledEnqueueTime: message.priority >= 8 ? undefined : new Date(Date.now() + 2000)
      }

      await sender.sendMessages(serviceBusMessage)
      console.log(`File ${message.fileId} queued for AI analysis`)
    } catch (error) {
      console.error('Error queueing for AI analysis:', error)
      throw new Error(`Failed to queue for AI analysis: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Queue session for results aggregation
   */
  async queueForResultsAggregation(message: ResultsAggregationMessage): Promise<void> {
    try {
      const sender = await this.getSender(this.config.queueNames.resultsAggregation)
      
      const serviceBusMessage: ServiceBusMessage = {
        body: message,
        messageId: `results-${message.sessionId}-${Date.now()}`,
        contentType: 'application/json',
        subject: 'results-aggregation',
        applicationProperties: {
          sessionId: message.sessionId,
          userId: message.userId,
          roleId: message.roleId
        },
        timeToLive: 6 * 60 * 60 * 1000 // 6 hours
      }

      await sender.sendMessages(serviceBusMessage)
      console.log(`Session ${message.sessionId} queued for results aggregation`)
    } catch (error) {
      console.error('Error queueing for results aggregation:', error)
      throw new Error(`Failed to queue for results aggregation: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Send batch of files for processing (up to 100 files)
   */
  async queueBatchForProcessing(messages: FileProcessingMessage[]): Promise<void> {
    try {
      if (messages.length === 0) return
      
      const sender = await this.getSender(this.config.queueNames.fileProcessing)
      
      // Split into batches of 100 (Service Bus limit)
      const batchSize = 100
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize)
        
        const serviceBusMessages: ServiceBusMessage[] = batch.map((message, index) => ({
          body: message,
          messageId: `batch-file-${message.fileId}-${Date.now()}-${index}`,
          contentType: 'application/json',
          subject: 'file-processing-batch',
          applicationProperties: {
            fileId: message.fileId,
            userId: message.userId,
            sessionId: message.sessionId,
            priority: message.priority,
            retryCount: message.retryCount || 0,
            batchIndex: i + index,
            batchTotal: messages.length
          },
          timeToLive: 24 * 60 * 60 * 1000
        }))

        await sender.sendMessages(serviceBusMessages)
        console.log(`Batch of ${batch.length} files queued for processing`)
      }
    } catch (error) {
      console.error('Error queueing batch for processing:', error)
      throw new Error(`Failed to queue batch for processing: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create a receiver for a specific queue (for Azure Functions)
   */
  createReceiver(queueName: string): ServiceBusReceiver {
    return this.client.createReceiver(queueName)
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string) {
    try {
      // Note: This would typically use Service Bus management operations
      // For now, we'll return a placeholder
      return {
        activeMessageCount: 0,
        deadLetterMessageCount: 0,
        scheduledMessageCount: 0
      }
    } catch (error) {
      console.error('Error getting queue stats:', error)
      return null
    }
  }

  /**
   * Close all senders and the client
   */
  async close(): Promise<void> {
    try {
      // Close all senders
      for (const sender of this.senders.values()) {
        await sender.close()
      }
      this.senders.clear()

      // Close the client
      await this.client.close()
      console.log('Service Bus connections closed')
    } catch (error) {
      console.error('Error closing Service Bus connections:', error)
    }
  }

  /**
   * Health check for Service Bus connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to create a sender to test connection
      const testSender = await this.getSender(this.config.queueNames.fileProcessing)
      return true
    } catch (error) {
      console.error('Service Bus health check failed:', error)
      return false
    }
  }
}

// Singleton instance
let serviceBusService: ServiceBusService | null = null

export function getServiceBusService(): ServiceBusService {
  if (!serviceBusService) {
    serviceBusService = new ServiceBusService()
  }
  return serviceBusService
}

export type { 
  FileProcessingMessage, 
  AIAnalysisMessage, 
  ResultsAggregationMessage 
}