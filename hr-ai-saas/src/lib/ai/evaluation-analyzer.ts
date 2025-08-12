interface RoleData {
  title: string
  skills: Array<{ skillName: string; weight: number; isRequired: boolean }>
  questions: Array<{ questionText: string; weight: number }>
  requirements?: {
    experience?: { min: number; max: number }
    education?: string
  }
}

interface AnalysisResult {
  overallScore: number
  skillMatches: Array<{
    skill: string
    found: boolean
    confidence: number
    evidence?: string
  }>
  questionAnswers: Array<{
    question: string
    answer: string
    score: number
  }>
  recommendations: string
  redFlags: string[]
  strengths: string[]
}

export class EvaluationAnalyzer {
  private apiKey: string
  private apiUrl = 'https://api.hyperbolic.xyz/v1/chat/completions'
  private lastRequestTime: Map<string, number> = new Map()
  private requestQueue: Map<string, number> = new Map()

  constructor() {
    this.apiKey = process.env.HYPERBOLIC_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('Hyperbolic API key not configured')
    }
  }

  /**
   * Rate limiting: 60 requests per minute per user
   */
  private async enforceRateLimit(userId: string): Promise<void> {
    const now = Date.now()
    const lastRequest = this.lastRequestTime.get(userId) || 0
    const userRequestCount = this.requestQueue.get(userId) || 0
    
    // Reset counter if more than a minute has passed
    if (now - lastRequest > 60000) {
      this.requestQueue.set(userId, 0)
    }
    
    // If at limit, wait until next minute window
    if (userRequestCount >= 60) {
      const waitTime = 60000 - (now - lastRequest)
      if (waitTime > 0) {
        console.log(`Rate limit reached for user ${userId}, waiting ${waitTime}ms`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        this.requestQueue.set(userId, 0)
      }
    }
    
    // Update counters
    this.lastRequestTime.set(userId, now)
    this.requestQueue.set(userId, userRequestCount + 1)
    
    // Add small delay between requests to be safe
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  /**
   * Analyze a single resume against a role
   */
  async analyzeResume(
    userId: string,
    resumeText: string,
    role: RoleData
  ): Promise<AnalysisResult> {
    await this.enforceRateLimit(userId)

    const prompt = this.buildPrompt(resumeText, role)
    
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'meta-llama/Llama-3.1-8B-Instruct',
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.3,
          top_p: 0.9
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`AI API error: ${response.status} - ${error}`)
      }

      const data = await response.json()
      const aiResponse = data.choices[0].message.content

      // Parse the JSON response
      return this.parseAIResponse(aiResponse)
    } catch (error) {
      console.error('AI analysis error:', error)
      throw error
    }
  }

  /**
   * Build the analysis prompt
   */
  private buildPrompt(resumeText: string, role: RoleData): string {
    const skillsList = role.skills.map(s => 
      `- ${s.skillName} (Weight: ${s.weight}/10${s.isRequired ? ', Required' : ''})`
    ).join('\n')

    const questionsList = role.questions.map(q => 
      `- ${q.questionText} (Weight: ${q.weight}/10)`
    ).join('\n')

    return `
Analyze this resume for the ${role.title} position.

ROLE REQUIREMENTS:
Skills to evaluate:
${skillsList}

Questions to answer:
${questionsList}

Experience Required: ${role.requirements?.experience?.min || 0}-${role.requirements?.experience?.max || 10} years
Education: ${role.requirements?.education || 'Not specified'}

RESUME TEXT:
${resumeText.substring(0, 4000)} // Limit to 4000 chars for token limits

Provide a comprehensive analysis following the JSON format specified.
`
  }

  /**
   * System prompt for consistent JSON output
   */
  private getSystemPrompt(): string {
    return `You are an expert HR AI assistant analyzing resumes. 
Always respond with valid JSON in exactly this format:
{
  "overallScore": <0-100>,
  "skillMatches": [
    {
      "skill": "<skill name>",
      "found": <true/false>,
      "confidence": <0-100>,
      "evidence": "<brief quote from resume if found>"
    }
  ],
  "questionAnswers": [
    {
      "question": "<question text>",
      "answer": "<your assessment>",
      "score": <0-10>
    }
  ],
  "recommendations": "<paragraph about candidate strengths>",
  "redFlags": ["<concern 1>", "<concern 2>"],
  "strengths": ["<strength 1>", "<strength 2>"]
}

Be objective, thorough, and base all assessments on evidence from the resume.`
  }

  /**
   * Parse AI response into structured format
   */
  private parseAIResponse(aiResponse: string): AnalysisResult {
    try {
      // Clean the response - remove any markdown formatting
      const cleanResponse = aiResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      const parsed = JSON.parse(cleanResponse)
      
      // Validate and return with defaults
      return {
        overallScore: parsed.overallScore || 0,
        skillMatches: parsed.skillMatches || [],
        questionAnswers: parsed.questionAnswers || [],
        recommendations: parsed.recommendations || '',
        redFlags: parsed.redFlags || [],
        strengths: parsed.strengths || []
      }
    } catch (error) {
      console.error('Failed to parse AI response:', error, aiResponse)
      
      // Return a default structure if parsing fails
      return {
        overallScore: 0,
        skillMatches: [],
        questionAnswers: [],
        recommendations: 'Unable to analyze resume due to parsing error',
        redFlags: ['Analysis failed'],
        strengths: []
      }
    }
  }

  /**
   * Process multiple resumes with batching
   */
  async processBatch(
    userId: string,
    resumes: Array<{ id: string; text: string }>,
    role: RoleData,
    onProgress?: (processed: number, total: number) => void
  ): Promise<Map<string, AnalysisResult>> {
    const results = new Map<string, AnalysisResult>()
    
    for (let i = 0; i < resumes.length; i++) {
      const resume = resumes[i]
      
      try {
        const result = await this.analyzeResume(userId, resume.text, role)
        results.set(resume.id, result)
      } catch (error) {
        console.error(`Failed to analyze resume ${resume.id}:`, error)
        results.set(resume.id, {
          overallScore: 0,
          skillMatches: [],
          questionAnswers: [],
          recommendations: 'Analysis failed',
          redFlags: ['Failed to process'],
          strengths: []
        })
      }
      
      if (onProgress) {
        onProgress(i + 1, resumes.length)
      }
    }
    
    return results
  }
}