import { updateFileStatus } from '../db-files'

interface HyperbolicRequest {
  model: string
  messages: Array<{
    role: 'system' | 'user'
    content: string
  }>
  max_tokens: number
  temperature: number
  top_p?: number
}

interface HyperbolicResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface ResumeAnalysisRequest {
  fileId: string
  roleId: string
  userId: string
  extractedText: string
  roleSkills: Array<{
    skillName: string
    weight: number
    isRequired: boolean
    skillCategory?: string
  }>
  roleQuestions: Array<{
    questionText: string
    weight: number
    category: string
  }>
}

interface ResumeAnalysisResult {
  fileId: string
  overallScore: number
  skillsAnalysis: Array<{
    skillName: string
    found: boolean
    confidence: number
    evidence: string[]
    weight: number
  }>
  questionsAnalysis: Array<{
    questionText: string
    answer: string
    score: number
    confidence: number
    weight: number
  }>
  summary: string
  recommendations: string[]
  redFlags: string[]
  totalTokensUsed: number
}

export class HyperbolicService {
  private apiKey: string
  private baseUrl = 'https://api.hyperbolic.xyz/v1'
  private rateLimitDelay = 1000 // 1 second between requests (60 per minute)

  constructor() {
    this.apiKey = process.env.HYPERBOLIC_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('HYPERBOLIC_API_KEY environment variable is required')
    }
    
    // Validate API key format (basic JWT-like format validation)
    if (this.apiKey.length < 20 || !this.apiKey.includes('.')) {
      throw new Error('HYPERBOLIC_API_KEY appears to be invalid - should be a JWT token')
    }
  }

  /**
   * Process a batch of resumes (max 50 per batch)
   */
  async processBatch(requests: ResumeAnalysisRequest[]): Promise<ResumeAnalysisResult[]> {
    if (requests.length > 50) {
      throw new Error('Batch size cannot exceed 50 requests')
    }

    console.log(`Processing batch of ${requests.length} resumes`)
    const results: ResumeAnalysisResult[] = []

    // Process requests sequentially to respect rate limits
    for (let i = 0; i < requests.length; i++) {
      const request = requests[i]
      
      try {
        console.log(`Processing resume ${i + 1}/${requests.length} - File ID: ${request.fileId}`)
        
        // Update file status to analyzing
        await updateFileStatus(request.fileId, {
          processingStatus: 'analyzing'
        })

        const result = await this.analyzeResume(request)
        results.push(result)

        // Rate limiting delay (except for last request)
        if (i < requests.length - 1) {
          await this.delay(this.rateLimitDelay)
        }

      } catch (error) {
        console.error(`Error processing resume ${request.fileId}:`, error)
        
        // Update file status to failed
        await updateFileStatus(request.fileId, {
          processingStatus: 'failed'
        })

        // Create a failed result
        results.push({
          fileId: request.fileId,
          overallScore: 0,
          skillsAnalysis: [],
          questionsAnalysis: [],
          summary: 'Analysis failed due to processing error',
          recommendations: [],
          redFlags: ['Processing failed'],
          totalTokensUsed: 0
        })
      }
    }

    console.log(`Completed batch processing: ${results.length} results`)
    return results
  }

  /**
   * Analyze a single resume
   */
  private async analyzeResume(request: ResumeAnalysisRequest): Promise<ResumeAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(request)
    
    const hyperbolicRequest: HyperbolicRequest = {
      model: 'meta-llama/Llama-3.3-70B-Instruct',
      messages: [
        {
          role: 'system',
          content: 'You are an expert HR AI assistant specializing in resume analysis and candidate evaluation. You provide accurate, consistent, and objective analysis based strictly on the role requirements. Always respond with valid JSON format and be precise in your scoring and evidence gathering.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2500,
      temperature: 0.1,
      top_p: 0.9
    }

    const response = await this.makeRequest(hyperbolicRequest)
    const analysisText = response.choices[0].message.content

    // Parse the structured response
    const result = this.parseAnalysisResponse(request.fileId, analysisText, response.usage.total_tokens)
    
    // Update file status to completed
    await updateFileStatus(request.fileId, {
      processingStatus: 'completed'
    })

    return result
  }

  /**
   * Build the analysis prompt
   */
  private buildAnalysisPrompt(request: ResumeAnalysisRequest): string {
    const skillsList = request.roleSkills.map(skill => 
      `- ${skill.skillName} (Weight: ${skill.weight}/10, Required: ${skill.isRequired ? 'Yes' : 'No'})${skill.skillCategory ? ` [${skill.skillCategory}]` : ''}`
    ).join('\n')

    const questionsList = request.roleQuestions.map(q => 
      `- ${q.questionText} (Weight: ${q.weight}/10) [Category: ${q.category}]`
    ).join('\n')

    return `Please analyze this resume against the specified role requirements and provide a structured evaluation.

ROLE REQUIREMENTS:

Skills Required:
${skillsList}

Evaluation Questions:
${questionsList}

RESUME TEXT:
${request.extractedText}

Please provide your analysis in the following JSON format:
{
  "overallScore": [0-100 integer score],
  "skillsAnalysis": [
    {
      "skillName": "[exact skill name from requirements]",
      "found": [true/false],
      "confidence": [0-100],
      "evidence": ["specific text/experience that demonstrates this skill"],
      "weight": [weight from requirements]
    }
  ],
  "questionsAnalysis": [
    {
      "questionText": "[exact question from requirements]",
      "answer": "[your assessment/answer based on resume]",
      "score": [0-100],
      "confidence": [0-100],
      "weight": [weight from requirements]
    }
  ],
  "summary": "[2-3 sentence overall assessment]",
  "recommendations": ["specific recommendations for this candidate"],
  "redFlags": ["any concerns or missing critical elements"]
}

Ensure your response is valid JSON only, no additional text.`
  }

  /**
   * Parse the AI response into structured data
   */
  private parseAnalysisResponse(fileId: string, responseText: string, tokensUsed: number): ResumeAnalysisResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      return {
        fileId,
        overallScore: Math.max(0, Math.min(100, parseInt(parsed.overallScore) || 0)),
        skillsAnalysis: Array.isArray(parsed.skillsAnalysis) ? parsed.skillsAnalysis : [],
        questionsAnalysis: Array.isArray(parsed.questionsAnalysis) ? parsed.questionsAnalysis : [],
        summary: parsed.summary || 'No summary provided',
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
        totalTokensUsed: tokensUsed
      }
    } catch (error) {
      console.error('Failed to parse AI response:', error)
      console.log('Raw response:', responseText)
      
      // Return a fallback result
      return {
        fileId,
        overallScore: 0,
        skillsAnalysis: [],
        questionsAnalysis: [],
        summary: 'Failed to parse AI analysis response',
        recommendations: [],
        redFlags: ['Analysis parsing failed'],
        totalTokensUsed: tokensUsed
      }
    }
  }

  /**
   * Make request to Hyperbolic API with retry logic
   */
  private async makeRequest(request: HyperbolicRequest, retryCount = 0): Promise<HyperbolicResponse> {
    const maxRetries = 3
    const backoffDelay = Math.pow(2, retryCount) * 1000 // Exponential backoff
    
    try {
      console.log(`Making Hyperbolic API request (attempt ${retryCount + 1}/${maxRetries + 1})`)
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'HR-AI-SaaS/1.0'
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(60000) // 60 second timeout
      })

      if (!response.ok) {
        const errorText = await response.text()
        
        // Check for rate limiting
        if (response.status === 429) {
          if (retryCount < maxRetries) {
            console.log(`Rate limited. Retrying in ${backoffDelay}ms...`)
            await this.delay(backoffDelay)
            return this.makeRequest(request, retryCount + 1)
          }
          throw new Error('Rate limit exceeded - please try again later')
        }
        
        // Check for server errors that might be retryable
        if (response.status >= 500 && retryCount < maxRetries) {
          console.log(`Server error ${response.status}. Retrying in ${backoffDelay}ms...`)
          await this.delay(backoffDelay)
          return this.makeRequest(request, retryCount + 1)
        }
        
        throw new Error(`Hyperbolic API error (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      console.log(`API request successful. Tokens used: ${data.usage?.total_tokens || 'unknown'}`)
      return data
      
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('API request timed out after 60 seconds')
      }
      
      if (retryCount < maxRetries && !(error instanceof Error && error.message.includes('API error'))) {
        console.log(`Request failed: ${error.message}. Retrying in ${backoffDelay}ms...`)
        await this.delay(backoffDelay)
        return this.makeRequest(request, retryCount + 1)
      }
      
      throw error
    }
  }

  /**
   * Delay utility for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Estimate token usage for a request
   */
  estimateTokens(request: ResumeAnalysisRequest): number {
    const promptLength = this.buildAnalysisPrompt(request).length
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(promptLength / 4) + 2000 // Add max_tokens for response
  }
}

// Export singleton instance
export const hyperbolicService = new HyperbolicService()