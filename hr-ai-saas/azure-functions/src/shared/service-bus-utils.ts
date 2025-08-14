import { ServiceBusClient, ServiceBusMessage, ServiceBusSender } from '@azure/service-bus'

let serviceBusClient: ServiceBusClient | null = null
const senders = new Map<string, ServiceBusSender>()

/**
 * Get Service Bus client (singleton)
 */
export function getServiceBusClient(): ServiceBusClient {
  if (!serviceBusClient) {
    const connectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING
    if (!connectionString) {
      throw new Error('AZURE_SERVICE_BUS_CONNECTION_STRING environment variable is required')
    }
    serviceBusClient = new ServiceBusClient(connectionString)
  }
  return serviceBusClient
}

/**
 * Get or create sender for queue
 */
export async function getSender(queueName: string): Promise<ServiceBusSender> {
  if (!senders.has(queueName)) {
    const client = getServiceBusClient()
    const sender = client.createSender(queueName)
    senders.set(queueName, sender)
  }
  return senders.get(queueName)!
}

/**
 * Queue file for PDF processing
 */
export async function queueFileForProcessing(message: {
  fileId: string
  userId: string
  sessionId: string
  blobName: string
  fileName: string
  priority: number
  retryCount?: number
}): Promise<void> {
  const sender = await getSender('file-processing')
  
  const serviceBusMessage: ServiceBusMessage = {
    body: message,
    messageId: `file-${message.fileId}-${Date.now()}`,
    contentType: 'application/json',
    subject: 'pdf-processing',
    applicationProperties: {
      fileId: message.fileId,
      userId: message.userId,
      sessionId: message.sessionId,
      priority: message.priority,
      retryCount: message.retryCount || 0
    },
    timeToLive: 24 * 60 * 60 * 1000, // 24 hours
    scheduledEnqueueTimeUtc: message.priority >= 8 ? undefined : new Date(Date.now() + 2000)
  }

  await sender.sendMessages(serviceBusMessage)
  console.log(`File ${message.fileId} queued for processing`)
}

/**
 * Queue extracted text for AI analysis
 */
export async function queueForAIAnalysis(message: {
  fileId: string
  userId: string
  roleId: string
  sessionId: string
  extractedText: string
  priority: number
  retryCount?: number
}): Promise<void> {
  const sender = await getSender('ai-analysis')
  
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
    scheduledEnqueueTimeUtc: message.priority >= 8 ? undefined : new Date(Date.now() + 1000)
  }

  await sender.sendMessages(serviceBusMessage)
  console.log(`File ${message.fileId} queued for AI analysis`)
}

/**
 * Queue session for completion check
 */
export async function queueSessionCompletion(message: {
  sessionId: string
  userId: string
  roleId: string
}): Promise<void> {
  const sender = await getSender('session-completion')
  
  const serviceBusMessage: ServiceBusMessage = {
    body: message,
    messageId: `session-${message.sessionId}-${Date.now()}`,
    contentType: 'application/json',
    subject: 'session-completion',
    applicationProperties: {
      sessionId: message.sessionId,
      userId: message.userId,
      roleId: message.roleId
    },
    timeToLive: 6 * 60 * 60 * 1000 // 6 hours
  }

  await sender.sendMessages(serviceBusMessage)
  console.log(`Session ${message.sessionId} queued for completion check`)
}

/**
 * Close all Service Bus connections
 */
export async function closeServiceBusConnections(): Promise<void> {
  try {
    // Close all senders
    for (const sender of senders.values()) {
      await sender.close()
    }
    senders.clear()

    // Close client
    if (serviceBusClient) {
      await serviceBusClient.close()
      serviceBusClient = null
    }
    
    console.log('Service Bus connections closed')
  } catch (error) {
    console.error('Error closing Service Bus connections:', error)
  }
}