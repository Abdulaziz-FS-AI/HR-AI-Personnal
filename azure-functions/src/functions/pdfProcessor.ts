import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
  output
} from '@azure/functions'
import { ServiceBusReceivedMessage } from '../types/azure-types'
import pdf from 'pdf-parse'
import { downloadBlobAsBuffer } from '../shared/blob-utils'
import {
  updateFileStatus,
  getFileById,
  getRoleWithDetails
} from '../shared/db-utils'
import { queueForAIAnalysis } from '../shared/service-bus-utils'

interface ExtractedResumeData {
  rawText: string
  cleanedText: string
  contactInfo: {
    name?: string
    email?: string
    phone?: string
    linkedin?: string
    github?: string
    location?: string
  }
  sections: {
    summary?: string
    experience?: string
    education?: string
    skills?: string
    projects?: string
    certifications?: string
    achievements?: string
  }
  metadata: {
    totalPages: number
    wordCount: number
    extractionConfidence: number
    hasContactInfo: boolean
    hasSections: boolean
  }
}

/**
 * PDF Processor Function - Triggered by Service Bus Queue
 */
async function pdfProcessor(
  message: ServiceBusReceivedMessage,
  context: InvocationContext
): Promise<void> {
  const startTime = Date.now()
  let fileId: string | undefined

  try {
    context.log('PDF Processor started', { messageId: message.messageId })

    // Parse message body
    const { fileId: msgFileId, userId, sessionId, blobName, fileName } = message.body

    fileId = msgFileId
    context.log('Processing file:', { fileId, blobName, fileName })

    // Update file status to processing
    await updateFileStatus(fileId, 'processing')

    // Get file details from database
    const fileRecord = await getFileById(fileId)
    if (!fileRecord) {
      throw new Error(`File record not found: ${fileId}`)
    }

    // Download PDF from blob storage
    context.log('Downloading PDF from blob storage')
    const pdfBuffer = await downloadBlobAsBuffer('resumes', blobName)

    // Extract text from PDF
    context.log('Extracting text from PDF')
    const extractedData = await extractTextFromPDF(pdfBuffer)

    // Clean and structure the text
    context.log('Processing extracted text')
    const processedData = processExtractedText(extractedData)

    // Update file with extracted text
    await updateFileStatus(fileId, 'analyzing', processedData.cleanedText)

    // Queue for AI analysis if role is specified
    if (fileRecord.roleId) {
      context.log('Queueing for AI analysis')
      await queueForAIAnalysis({
        fileId,
        userId,
        roleId: fileRecord.roleId,
        sessionId,
        extractedText: JSON.stringify({
          text: processedData.cleanedText,
          sections: processedData.sections,
          contactInfo: processedData.contactInfo,
          metadata: processedData.metadata
        }),
        priority: 5,
        retryCount: 0
      })
    } else {
      // Mark as analyzed if no role specified
      await updateFileStatus(fileId, 'analyzed')
    }

    const processingTime = Date.now() - startTime
    context.log('PDF processing completed', {
      fileId,
      processingTimeMs: processingTime,
      wordCount: processedData.metadata.wordCount,
      confidence: processedData.metadata.extractionConfidence
    })

  } catch (error) {
    context.error('PDF processing failed:', error)

    if (fileId) {
      await updateFileStatus(
        fileId,
        'failed',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }

    // Check retry count
    const retryCount = (message.applicationProperties?.retryCount as number) || 0
    if (retryCount < 3) {
      // Allow function to throw error for automatic retry
      throw error
    } else {
      // Max retries reached, log and complete
      context.error('Max retries reached for file:', fileId)
    }
  }
}

/**
 * Extract text from PDF buffer using pdf-parse
 */
async function extractTextFromPDF(pdfBuffer: Buffer): Promise<{
  text: string
  pages: number
  info: Record<string, unknown>
  metadata: Record<string, unknown>
  version: string
}> {
  try {
    const data = await pdf(pdfBuffer, {
      max: 0, // Extract all pages
      normalizeWhitespace: true
    })

    return {
      text: data.text,
      pages: data.numpages,
      info: data.info,
      metadata: data.metadata,
      version: data.version
    }
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Process and structure extracted text
 */
function processExtractedText(extractedData: {
  text: string
  pages: number
  info: Record<string, unknown>
  metadata: Record<string, unknown>
  version: string
}): ExtractedResumeData {
  const rawText = extractedData.text || ''
  
  // Clean the text
  const cleanedText = cleanText(rawText)
  
  // Extract contact information
  const contactInfo = extractContactInfo(cleanedText)
  
  // Extract resume sections
  const sections = extractResumeSections(cleanedText)
  
  // Calculate metadata
  const wordCount = cleanedText.split(/\s+/).filter(word => word.length > 0).length
  const hasContactInfo = !!(contactInfo.email || contactInfo.phone)
  const hasSections = Object.values(sections).some(section => section && section.length > 50)
  
  // Calculate extraction confidence
  const extractionConfidence = calculateExtractionConfidence({
    textLength: cleanedText.length,
    wordCount,
    hasContactInfo,
    hasSections,
    pagesCount: extractedData.pages
  })

  return {
    rawText,
    cleanedText,
    contactInfo,
    sections,
    metadata: {
      totalPages: extractedData.pages || 1,
      wordCount,
      extractionConfidence,
      hasContactInfo,
      hasSections
    }
  }
}

/**
 * Clean extracted text
 */
function cleanText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove null bytes and special characters
    .replace(/\0/g, '')
    // Fix common OCR issues
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
    // Normalize quotes
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    // Remove page numbers and headers/footers patterns
    .replace(/Page \d+ of \d+/gi, '')
    .replace(/\d+\s*\/\s*\d+/g, '')
    // Trim
    .trim()
}

/**
 * Extract contact information using regex patterns
 */
function extractContactInfo(text: string): ExtractedResumeData['contactInfo'] {
  const contactInfo: ExtractedResumeData['contactInfo'] = {}

  // Extract email
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
  if (emailMatch) {
    contactInfo.email = emailMatch[1].toLowerCase()
  }

  // Extract phone (multiple formats)
  const phonePatterns = [
    /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/,
    /(\d{3}[-.\s]\d{3}[-.\s]\d{4})/,
    /(\(\d{3}\)\s*\d{3}-\d{4})/
  ]
  
  for (const pattern of phonePatterns) {
    const phoneMatch = text.match(pattern)
    if (phoneMatch) {
      contactInfo.phone = phoneMatch[1]
      break
    }
  }

  // Extract LinkedIn
  const linkedinMatch = text.match(/linkedin\.com\/in\/([\w-]+)/i)
  if (linkedinMatch) {
    contactInfo.linkedin = `linkedin.com/in/${linkedinMatch[1]}`
  }

  // Extract GitHub
  const githubMatch = text.match(/github\.com\/([\w-]+)/i)
  if (githubMatch) {
    contactInfo.github = `github.com/${githubMatch[1]}`
  }

  // Extract name (usually at the beginning)
  const lines = text.split('\n').filter(line => line.trim())
  if (lines.length > 0) {
    // Assume first non-empty line might be the name
    const potentialName = lines[0].trim()
    if (potentialName.length < 50 && !potentialName.includes('@')) {
      contactInfo.name = potentialName
    }
  }

  // Extract location (common patterns)
  const locationMatch = text.match(/([A-Za-z\s]+,\s*[A-Z]{2}(?:\s+\d{5})?)/i)
  if (locationMatch) {
    contactInfo.location = locationMatch[1]
  }

  return contactInfo
}

/**
 * Extract resume sections using common headers
 */
function extractResumeSections(text: string): ExtractedResumeData['sections'] {
  const sections: ExtractedResumeData['sections'] = {}
  
  // Section headers to look for
  const sectionPatterns = {
    summary: /(?:summary|objective|profile|about me?)\s*:?\s*/i,
    experience: /(?:work experience|experience|employment history?|professional experience)\s*:?\s*/i,
    education: /(?:education|academic background|qualifications)\s*:?\s*/i,
    skills: /(?:skills|technical skills|core competencies|technologies)\s*:?\s*/i,
    projects: /(?:projects|key projects|portfolio)\s*:?\s*/i,
    certifications: /(?:certifications?|certificates?|licenses?)\s*:?\s*/i,
    achievements: /(?:achievements?|accomplishments?|awards?|honors?)\s*:?\s*/i
  }

  // Try to extract each section
  Object.entries(sectionPatterns).forEach(([sectionName, pattern]) => {
    const match = text.match(pattern)
    if (match) {
      const startIndex = match.index! + match[0].length
      const endPatterns = Object.values(sectionPatterns).filter(p => p !== pattern)
      
      // Find the next section header
      let endIndex = text.length
      for (const endPattern of endPatterns) {
        const endMatch = text.slice(startIndex).match(endPattern)
        if (endMatch && endMatch.index !== undefined) {
          endIndex = Math.min(endIndex, startIndex + endMatch.index)
        }
      }
      
      // Extract section content
      const sectionContent = text.slice(startIndex, endIndex).trim()
      if (sectionContent.length > 10) {
        sections[sectionName as keyof ExtractedResumeData['sections']] = sectionContent
      }
    }
  })

  return sections
}

/**
 * Calculate extraction confidence score
 */
function calculateExtractionConfidence(params: {
  textLength: number
  wordCount: number
  hasContactInfo: boolean
  hasSections: boolean
  pagesCount: number
}): number {
  let confidence = 0

  // Base confidence from text length
  if (params.textLength > 500) confidence += 30
  else if (params.textLength > 200) confidence += 20
  else if (params.textLength > 100) confidence += 10

  // Word count contribution
  if (params.wordCount > 300) confidence += 20
  else if (params.wordCount > 150) confidence += 15
  else if (params.wordCount > 50) confidence += 10

  // Contact info is crucial
  if (params.hasContactInfo) confidence += 25

  // Having identifiable sections
  if (params.hasSections) confidence += 20

  // Reasonable page count
  if (params.pagesCount >= 1 && params.pagesCount <= 5) confidence += 5

  return Math.min(100, confidence)
}

// Register the function
app.serviceBusQueue('pdfProcessor', {
  connection: 'AZURE_SERVICE_BUS_CONNECTION_STRING',
  queueName: 'file-processing',
  handler: pdfProcessor
})

export { pdfProcessor }