/**
 * Simple logger implementation
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogEntry {
  id: string
  timestamp: Date
  level: LogLevel
  message: string
  metadata?: any
  source?: string
}

class Logger {
  private logs: LogEntry[] = []

  log(level: LogLevel, message: string, metadata?: any) {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level,
      message,
      metadata,
      source: 'app'
    }
    
    this.logs.push(entry)
    
    // Also log to console
    console.log(`[${level.toUpperCase()}] ${message}`, metadata || '')
    
    return entry
  }

  debug(message: string, metadata?: any) {
    return this.log(LogLevel.DEBUG, message, metadata)
  }

  info(message: string, metadata?: any) {
    return this.log(LogLevel.INFO, message, metadata)
  }

  warn(message: string, metadata?: any) {
    return this.log(LogLevel.WARN, message, metadata)
  }

  error(message: string, metadata?: any) {
    return this.log(LogLevel.ERROR, message, metadata)
  }

  getLogs() {
    return this.logs
  }

  clearLogs() {
    this.logs = []
  }
}

export const logger = new Logger()
export default logger