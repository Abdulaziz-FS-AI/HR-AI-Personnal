/**
 * Simplified Evaluation Queue Service
 * Fire-and-forget processing with Azure Service Bus
 */

import { ServiceBusClient, ServiceBusMessage } from '@azure/service-bus'

export interface EvaluationQueueMessage {
  evaluationId: string
  roleId: string
  userId: string
  userEmail: string
  roleTitle: string
  files: Array<{
    id: string
    filename: string
    content: string // Base64 or text
  }>
  timestamp: string
}

class EvaluationQueueService {
  private client: ServiceBusClient | null = null
  private connectionString: string | null = null
  private isConnected: boolean = false

  constructor() {
    this.connectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING || null
    if (this.connectionString) {
      this.connect()
    }
  }

  /**
   * Connect to Service Bus
   */
  private connect(): void {
    try {
      if (this.connectionString) {
        this.client = new ServiceBusClient(this.connectionString)
        this.isConnected = true
        console.log('✅ Service Bus connected')
      }
    } catch (error) {
      console.error('❌ Service Bus connection failed:', error)
      this.isConnected = false
    }
  }

  /**
   * Queue evaluation for processing
   */
  async queueEvaluation(data: EvaluationQueueMessage): Promise<{ success: boolean; error?: string }> {
    // If Service Bus is not available, return error
    if (!this.client || !this.isConnected) {
      console.warn('⚠️ Service Bus not available')
      return { 
        success: false, 
        error: 'Queue service not available. Processing will happen synchronously.' 
      }
    }

    try {
      const sender = this.client.createSender('evaluation-queue')
      
      const message: ServiceBusMessage = {
        body: data,
        contentType: 'application/json',
        subject: 'evaluation-processing',
        messageId: `eval-${data.evaluationId}`,
        sessionId: data.evaluationId,
        timeToLive: 3600000 // 1 hour
      }

      await sender.sendMessages(message)
      await sender.close()

      console.log(`✅ Queued evaluation ${data.evaluationId} with ${data.files.length} files`)
      return { success: true }

    } catch (error) {
      console.error('❌ Failed to queue evaluation:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to queue' 
      }
    }
  }

  /**
   * Check if queue service is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.isConnected = false
    }
  }
}

// Export singleton
export const evaluationQueue = new EvaluationQueueService()