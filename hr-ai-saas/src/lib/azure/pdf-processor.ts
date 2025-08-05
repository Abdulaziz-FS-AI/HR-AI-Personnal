import pdf from 'pdf-parse'
import { BlobServiceClient } from '@azure/storage-blob'
import { updateFileStatus } from '../db-files'
import { getServiceBusService, type AIAnalysisMessage } from './service-bus'

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

export class PDFProcessor {
  private blobServiceClient: BlobServiceClient

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || ''
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
  }

  /**
   * Main processing function called by Azure Function
   */
  async processPDFFile(
    fileId: string,
    blobName: string,
    roleId?: string
  ): Promise<ExtractedResumeData> {
    try {
      // 1. Download PDF from blob storage
      console.log(`Downloading PDF: ${blobName}`)
      const pdfBuffer = await this.downloadPDFFromBlob(blobName)

      // 2. Extract text from PDF
      console.log(`Extracting text from PDF: ${blobName}`)
      const extractedData = await this.extractTextFromPDF(pdfBuffer)

      // 3. Clean and structure the text
      console.log(`Processing extracted text for: ${blobName}`)
      const processedData = this.processExtractedText(extractedData)

      // 4. Update database with extracted data
      await updateFileStatus(fileId, {
        processingStatus: 'analyzing',
        extractedText: processedData.cleanedText
      })

      // 5. Queue for AI analysis if role is specified
      if (roleId) {
        await this.queueForAIAnalysis(fileId, roleId, processedData)
      }

      return processedData

    } catch (error) {
      console.error(`Error processing PDF ${blobName}:`, error)
      
      // Update file status to failed
      await updateFileStatus(fileId, {
        processingStatus: 'failed',
        extractedText: null
      })

      throw error
    }
  }

  /**
   * Download PDF from Azure Blob Storage
   */
  private async downloadPDFFromBlob(blobName: string): Promise<Buffer> {
    const containerClient = this.blobServiceClient.getContainerClient('resumes')
    const blobClient = containerClient.getBlobClient(blobName)
    
    const downloadResponse = await blobClient.download()
    const stream = downloadResponse.readableStreamBody
    
    if (!stream) {
      throw new Error('Failed to download blob stream')
    }

    // Convert stream to buffer
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }
    
    return Buffer.concat(chunks)
  }

  /**
   * Extract text from PDF buffer using pdf-parse
   */
  private async extractTextFromPDF(pdfBuffer: Buffer): Promise<{
    text: string
    pages: number
    info: Record<string, unknown>
    metadata: Record<string, unknown>
    version: string
  }> {
    try {
      const data = await pdf(pdfBuffer, {
        // Options for better extraction
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
  private processExtractedText(extractedData: {
    text: string
    pages: number
    info: Record<string, unknown>
    metadata: Record<string, unknown>
    version: string
  }): ExtractedResumeData {
    const rawText = extractedData.text || ''
    
    // Clean the text
    const cleanedText = this.cleanText(rawText)
    
    // Extract contact information
    const contactInfo = this.extractContactInfo(cleanedText)
    
    // Extract resume sections
    const sections = this.extractResumeSections(cleanedText)
    
    // Calculate metadata
    const wordCount = cleanedText.split(/\s+/).filter(word => word.length > 0).length
    const hasContactInfo = !!(contactInfo.email || contactInfo.phone)
    const hasSections = Object.values(sections).some(section => section && section.length > 50)
    
    // Calculate extraction confidence
    const extractionConfidence = this.calculateExtractionConfidence({
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
  private cleanText(text: string): string {
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
  private extractContactInfo(text: string): ExtractedResumeData['contactInfo'] {
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
  private extractResumeSections(text: string): ExtractedResumeData['sections'] {
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
  private calculateExtractionConfidence(params: {
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

  /**
   * Queue extracted data for AI analysis
   */
  private async queueForAIAnalysis(
    fileId: string,
    roleId: string,
    extractedData: ExtractedResumeData
  ): Promise<void> {
    const serviceBus = getServiceBusService()
    
    // Get role details from database (you'd implement this)
    const roleSkills = [] // await getRoleSkills(roleId)
    const roleQuestions = [] // await getRoleQuestions(roleId)

    const message: AIAnalysisMessage = {
      fileId,
      userId: '', // Get from file record
      roleId,
      sessionId: '', // Get from file record
      extractedText: JSON.stringify({
        text: extractedData.cleanedText,
        sections: extractedData.sections,
        contactInfo: extractedData.contactInfo,
        metadata: extractedData.metadata
      }),
      roleSkills,
      roleQuestions,
      priority: 5,
      retryCount: 0
    }

    await serviceBus.queueForAIAnalysis(message)
    console.log(`Queued file ${fileId} for AI analysis`)
  }
}

// Export singleton instance
export const pdfProcessor = new PDFProcessor()