// Type definitions for Azure Functions compatibility
export interface ServiceBusReceivedMessage {
  body: any
  messageId?: string
  sessionId?: string
  correlationId?: string
  deliveryCount?: number
  enqueuedTimeUtc?: Date
  expiresAtUtc?: Date
  sequenceNumber?: number
  timeToLive?: number
  subject?: string
  contentType?: string
  replyTo?: string
  replyToSessionId?: string
  scheduledEnqueueTimeUtc?: Date
  applicationProperties?: { [key: string]: any }
}