import { PDFDocument } from 'pdf-lib'

export interface ExtractedResumeData {
  fullText: string
  sections: {
    contact?: string
    summary?: string
    experience?: string
    education?: string
    skills?: string
    certifications?: string
  }
  metadata: {
    pageCount: number
    wordCount: number
    extractedAt: Date
  }
  contact?: {
    email?: string
    phone?: string
    linkedin?: string
    github?: string
  }
}

export class PDFTextExtractorFixed {
  /**
   * Extract text from PDF buffer without pdf-parse to avoid test file errors
   */
  async extractText(pdfBuffer: Buffer): Promise<ExtractedResumeData> {
    try {
      // Use pdf-lib for metadata
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const pageCount = pdfDoc.getPageCount()
      
      let fullText = ''
      
      // Direct buffer text extraction without pdf-parse
      try {
        // Extract text by analyzing PDF structure directly
        fullText = await this.extractTextFromBuffer(pdfBuffer)
      } catch (extractError) {
        console.warn('Primary extraction failed, using fallback')
        // Fallback: Basic text extraction
        fullText = this.extractTextFallback(pdfBuffer)
      }
      
      // If still no text, provide a meaningful default
      if (!fullText || fullText.trim().length === 0) {
        fullText = 'PDF content could not be extracted. Please ensure the file contains selectable text.'
      }
      
      const wordCount = fullText.split(/\s+/).filter(word => word.length > 0).length
      
      // Extract sections and contact info
      const sections = this.extractSections(fullText)
      const contact = this.extractContactInfo(fullText)
      
      return {
        fullText,
        sections,
        metadata: {
          pageCount,
          wordCount,
          extractedAt: new Date()
        },
        contact
      }
    } catch (error) {
      console.error('PDF extraction error:', error)
      // Return a minimal valid response instead of throwing
      return {
        fullText: 'PDF extraction failed. Please ensure the file is a valid PDF.',
        sections: {},
        metadata: {
          pageCount: 0,
          wordCount: 0,
          extractedAt: new Date()
        }
      }
    }
  }

  /**
   * Extract text from PDF buffer directly without pdf-parse
   */
  private async extractTextFromBuffer(buffer: Buffer): Promise<string> {
    try {
      // Convert buffer to string and look for text patterns
      const bufferString = buffer.toString('binary')
      
      // Look for text between PDF stream markers
      const textMatches: string[] = []
      
      // Pattern 1: Text between BT (Begin Text) and ET (End Text) markers
      const btEtPattern = /BT\s*(.*?)\s*ET/gs
      const btEtMatches = bufferString.matchAll(btEtPattern)
      for (const match of btEtMatches) {
        if (match[1]) {
          // Extract text from PDF commands
          const textContent = this.extractTextFromPDFCommands(match[1])
          if (textContent) textMatches.push(textContent)
        }
      }
      
      // Pattern 2: Look for readable text sequences
      const readablePattern = /[\x20-\x7E]{10,}/g
      const readableMatches = bufferString.matchAll(readablePattern)
      for (const match of readableMatches) {
        const text = match[0].trim()
        // Filter out PDF commands and binary data
        if (text && !text.includes('<<') && !text.includes('>>') && 
            !text.startsWith('/') && !text.match(/^\d+\s+\d+\s+obj/)) {
          textMatches.push(text)
        }
      }
      
      // Combine and clean extracted text
      let combinedText = textMatches.join(' ')
      
      // Clean up the text
      combinedText = combinedText
        .replace(/\([^)]*\)/g, (match) => {
          // Keep text inside parentheses if it looks like actual content
          const inner = match.slice(1, -1)
          return inner.match(/^[\x20-\x7E]+$/) ? inner : ''
        })
        .replace(/[<>\/\[\]{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      return combinedText || ''
    } catch (error) {
      console.error('Buffer extraction error:', error)
      return ''
    }
  }
  
  /**
   * Extract text from PDF text commands
   */
  private extractTextFromPDFCommands(commands: string): string {
    try {
      // Look for text in parentheses (PDF text strings)
      const textPattern = /\(([^)]+)\)/g
      const matches = commands.matchAll(textPattern)
      const textParts: string[] = []
      
      for (const match of matches) {
        if (match[1]) {
          // Unescape PDF string escapes
          const unescaped = match[1]
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .replace(/\\\\/g, '\\')
          
          textParts.push(unescaped)
        }
      }
      
      return textParts.join(' ')
    } catch {
      return ''
    }
  }

  /**
   * Fallback text extraction for when pdf-parse fails
   */
  private extractTextFallback(buffer: Buffer): string {
    try {
      // Basic text extraction by converting buffer to string
      // This won't be perfect but better than nothing
      const text = buffer.toString('utf8')
      // Extract readable ASCII characters
      const cleaned = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                          .replace(/\s+/g, ' ')
                          .trim()
      return cleaned.substring(0, 10000) // Limit to 10k chars for safety
    } catch {
      return ''
    }
  }

  /**
   * Extract contact information from text
   */
  private extractContactInfo(text: string): ExtractedResumeData['contact'] {
    const contact: ExtractedResumeData['contact'] = {}
    
    // Email pattern
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
    if (emailMatch) {
      contact.email = emailMatch[1].toLowerCase()
    }
    
    // Phone pattern (US format)
    const phoneMatch = text.match(/(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/i)
    if (phoneMatch) {
      contact.phone = phoneMatch[1]
    }
    
    // LinkedIn
    const linkedinMatch = text.match(/linkedin\.com\/in\/([\w-]+)/i)
    if (linkedinMatch) {
      contact.linkedin = `linkedin.com/in/${linkedinMatch[1]}`
    }
    
    // GitHub
    const githubMatch = text.match(/github\.com\/([\w-]+)/i)
    if (githubMatch) {
      contact.github = `github.com/${githubMatch[1]}`
    }
    
    return contact
  }

  /**
   * Extract common resume sections
   */
  private extractSections(text: string): ExtractedResumeData['sections'] {
    const sections: ExtractedResumeData['sections'] = {}
    
    // Define section patterns
    const sectionPatterns = {
      contact: /(?:contact|email|phone|address|linkedin|github)[\s\S]{0,500}?(?=\n\n|\n[A-Z]|$)/i,
      summary: /(?:summary|objective|profile|about)[\s\S]{0,1000}?(?=\n\n|\n[A-Z]|$)/i,
      experience: /(?:experience|employment|work history|professional experience)[\s\S]{0,3000}?(?=\n\n|\n[A-Z]|$)/i,
      education: /(?:education|academic|qualification|degree)[\s\S]{0,1000}?(?=\n\n|\n[A-Z]|$)/i,
      skills: /(?:skills|technical skills|competencies|expertise)[\s\S]{0,1000}?(?=\n\n|\n[A-Z]|$)/i,
      certifications: /(?:certification|certificates|training|courses)[\s\S]{0,1000}?(?=\n\n|\n[A-Z]|$)/i
    }
    
    // Extract each section with length limits
    for (const [section, pattern] of Object.entries(sectionPatterns)) {
      const match = text.match(pattern)
      if (match) {
        sections[section as keyof typeof sections] = match[0].trim()
      }
    }
    
    // If no sections found, treat entire text as experience
    if (Object.keys(sections).length === 0 && text.length > 50) {
      sections.experience = text.substring(0, 3000).trim()
    }
    
    return sections
  }

  /**
   * Clean and normalize text
   */
  cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable characters
      .trim()
  }
}

// Export singleton instance
export const pdfTextExtractorFixed = new PDFTextExtractorFixed()