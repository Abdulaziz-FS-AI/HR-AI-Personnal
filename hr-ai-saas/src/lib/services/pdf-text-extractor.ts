// Dynamic import to avoid build issues with pdf-parse
let pdf: any

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
}

export class PDFTextExtractor {
  /**
   * Extract text from PDF buffer
   */
  async extractText(pdfBuffer: Buffer): Promise<ExtractedResumeData> {
    try {
      // Lazy load pdf-parse
      if (!pdf) {
        pdf = (await import('pdf-parse')).default
      }
      
      const data = await pdf(pdfBuffer)
      
      const fullText = data.text
      const wordCount = fullText.split(/\s+/).filter(word => word.length > 0).length
      
      // Extract sections (basic implementation - can be enhanced with NLP)
      const sections = this.extractSections(fullText)
      
      return {
        fullText,
        sections,
        metadata: {
          pageCount: data.numpages,
          wordCount,
          extractedAt: new Date()
        }
      }
    } catch (error) {
      console.error('PDF extraction error:', error)
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract common resume sections
   */
  private extractSections(text: string): ExtractedResumeData['sections'] {
    const sections: ExtractedResumeData['sections'] = {}
    
    // Define section patterns
    const sectionPatterns = {
      contact: /(?:contact|email|phone|address|linkedin|github)[\s\S]*?(?=\n\n|\n[A-Z]|$)/i,
      summary: /(?:summary|objective|profile|about)[\s\S]*?(?=\n\n|\n[A-Z]|$)/i,
      experience: /(?:experience|employment|work history|professional experience)[\s\S]*?(?=\n\n|\n[A-Z]|$)/i,
      education: /(?:education|academic|qualification|degree)[\s\S]*?(?=\n\n|\n[A-Z]|$)/i,
      skills: /(?:skills|technical skills|competencies|expertise)[\s\S]*?(?=\n\n|\n[A-Z]|$)/i,
      certifications: /(?:certification|certificates|training|courses)[\s\S]*?(?=\n\n|\n[A-Z]|$)/i
    }
    
    // Extract each section
    for (const [section, pattern] of Object.entries(sectionPatterns)) {
      const match = text.match(pattern)
      if (match) {
        sections[section as keyof typeof sections] = match[0].trim()
      }
    }
    
    // If no sections found, treat entire text as experience
    if (Object.keys(sections).length === 0) {
      sections.experience = text.trim()
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