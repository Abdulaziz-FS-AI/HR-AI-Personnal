/**
 * Log aggregator for collecting and analyzing logs
 */

import { logger, LogLevel, LogEntry } from './logger'

export class LogAggregator {
  private static instance: LogAggregator
  
  private constructor() {}
  
  static getInstance(): LogAggregator {
    if (!this.instance) {
      this.instance = new LogAggregator()
    }
    return this.instance
  }

  async getLogById(id: string): Promise<LogEntry | null> {
    const logs = logger.getLogs()
    return logs.find(log => log.id === id) || null
  }

  async getLogAnalytics() {
    const logs = logger.getLogs()
    
    const analytics = {
      total: logs.length,
      byLevel: {
        debug: logs.filter(l => l.level === LogLevel.DEBUG).length,
        info: logs.filter(l => l.level === LogLevel.INFO).length,
        warn: logs.filter(l => l.level === LogLevel.WARN).length,
        error: logs.filter(l => l.level === LogLevel.ERROR).length
      },
      recent: logs.slice(-10),
      errors: logs.filter(l => l.level === LogLevel.ERROR).slice(-5)
    }
    
    return analytics
  }

  async cleanupOldLogs(daysToKeep: number = 7) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    const logs = logger.getLogs()
    const recentLogs = logs.filter(log => log.timestamp > cutoffDate)
    
    const removed = logs.length - recentLogs.length
    
    // In a real implementation, we'd update the logger's internal state
    // For now, just return the count
    
    return {
      removed,
      remaining: recentLogs.length
    }
  }

  async searchLogs(query: string, level?: LogLevel) {
    const logs = logger.getLogs()
    
    let filtered = logs.filter(log => 
      log.message.toLowerCase().includes(query.toLowerCase()) ||
      JSON.stringify(log.metadata).toLowerCase().includes(query.toLowerCase())
    )
    
    if (level) {
      filtered = filtered.filter(log => log.level === level)
    }
    
    return filtered
  }
}

export const logAggregator = LogAggregator.getInstance()