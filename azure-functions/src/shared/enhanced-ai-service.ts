import axios, { AxiosError } from 'axios'
import { InvocationContext } from '@azure/functions'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { getDbManager } from './enhanced-db-utils'

interface AIConfig {
  apiUrl: string
  apiKey: string
  model: string
  maxTokens: number
  temperature: number
  timeout: number
  rateLimits: {
    perUser: { requests: number; window: number }
    global: { requests: number; window: number }
    cost: { maxDailyCost: number; maxMonthlyCost: number }
  }
  retryConfig: {
    maxRetries: number
    baseDelay: number
    maxDelay: number
  }
}

interface CostTracker {
  userId: string
  dailyCost: number
  monthlyCost: number
  requestCount: number
  lastReset: {
    daily: Date
    monthly: Date
  }
}

interface AIAnalysisRequest {
  userId: string
  resumeText: string
  role: {
    title: string
    department: string
    description?: string
    skills: Array<{
      skillName: string
      weight: number
      isRequired: boolean
      category?: string
    }>
    questions: Array<{
      questionText: string
      weight: number
      category?: string
    }>
  }
}

interface AIAnalysisResponse {
  overallScore: number
  technicalScore: number
  experienceScore: number
  educationScore: number
  skillsScore: number
  cultureFitScore: number
  executiveSummary: string
  detailedAnalysis: string
  topStrengths: string[]
  concernsGaps: string[]
  redFlags: string[]
  standoutAchievements: string[]
  interviewQuestions: string[]
  recommendation: 'accept' | 'maybe' | 'reject'
  recommendationReason: string
  matchedSkills: Record<string, string>
  missingRequiredSkills: string[]
  metadata: {
    aiModelUsed: string
    processingTimeSeconds: number
    tokensUsed: { prompt: number; completion: number; total: number }
    aiCost: number
    requestId: string
  }
}

export class EnhancedAIService {
  private config: AIConfig
  private userRateLimiter: RateLimiterMemory
  private globalRateLimiter: RateLimiterMemory
  private costTrackers = new Map<string, CostTracker>()

  constructor() {
    this.config = {
      apiUrl: process.env.HYPERBOLIC_API_URL || 'https://api.hyperbolic.xyz/v1/chat/completions',
      apiKey: process.env.HYPERBOLIC_API_KEY || '',
      model: process.env.AI_MODEL || 'meta-llama/Llama-3.1-8B-Instruct',
      maxTokens: parseInt(process.env.MAX_TOKENS || '4000'),
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.1'),
      timeout: parseInt(process.env.AI_TIMEOUT || '120000'), // 2 minutes
      rateLimits: {
        perUser: { 
          requests: parseInt(process.env.USER_AI_RATE_LIMIT || '10'), 
          window: parseInt(process.env.USER_AI_RATE_WINDOW || '3600') // 1 hour
        },
        global: { 
          requests: parseInt(process.env.GLOBAL_AI_RATE_LIMIT || '100'), 
          window: parseInt(process.env.GLOBAL_AI_RATE_WINDOW || '3600') // 1 hour
        },
        cost: {
          maxDailyCost: parseFloat(process.env.MAX_DAILY_AI_COST || '100'), // $100/day
          maxMonthlyCost: parseFloat(process.env.MAX_MONTHLY_AI_COST || '2000') // $2000/month
        }
      },
      retryConfig: {
        maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3'),
        baseDelay: parseInt(process.env.AI_RETRY_DELAY || '1000'),
        maxDelay: parseInt(process.env.AI_MAX_RETRY_DELAY || '10000')
      }
    }

    if (!this.config.apiKey) {
      throw new Error('HYPERBOLIC_API_KEY environment variable is required')
    }

    // Initialize rate limiters
    this.userRateLimiter = new RateLimiterMemory({
      keyGenerator: (userId: string) => `ai-user-${userId}`,
      points: this.config.rateLimits.perUser.requests,
      duration: this.config.rateLimits.perUser.window
    })

    this.globalRateLimiter = new RateLimiterMemory({
      keyGenerator: () => 'ai-global',
      points: this.config.rateLimits.global.requests,
      duration: this.config.rateLimits.global.window
    })
  }

  /**
   * Analyze resume with comprehensive controls
   */
  async analyzeResume(
    request: AIAnalysisRequest,
    context: InvocationContext
  ): Promise<AIAnalysisResponse> {
    const startTime = Date.now()
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    context.log('AI analysis started', {
      requestId,
      userId: request.userId,
      resumeLength: request.resumeText.length,
      roleTitle: request.role.title
    })

    try {
      // 1. Rate limiting checks
      await this.checkRateLimits(request.userId, context)

      // 2. Cost control checks
      await this.checkCostLimits(request.userId, context)

      // 3. Validate and prepare request
      const prompt = this.buildAnalysisPrompt(request.resumeText, request.role)
      this.validatePrompt(prompt, context)

      // 4. Make AI API call with retries
      const apiResponse = await this.makeAIRequest(prompt, requestId, context)

      // 5. Parse and validate response
      const analysis = this.parseAIResponse(apiResponse.data, context)

      // 6. Calculate costs and update trackers
      const cost = this.calculateCost(apiResponse.data.usage)
      await this.updateCostTracking(request.userId, cost, context)

      // 7. Log successful analysis
      const processingTime = Math.floor((Date.now() - startTime) / 1000)
      context.log('AI analysis completed successfully', {
        requestId,
        userId: request.userId,
        processingTimeSeconds: processingTime,
        overallScore: analysis.overallScore,
        recommendation: analysis.recommendation,
        tokensUsed: apiResponse.data.usage?.total_tokens || 0,
        cost: cost
      })

      return {
        ...analysis,
        metadata: {
          aiModelUsed: this.config.model,
          processingTimeSeconds: processingTime,
          tokensUsed: {
            prompt: apiResponse.data.usage?.prompt_tokens || 0,
            completion: apiResponse.data.usage?.completion_tokens || 0,
            total: apiResponse.data.usage?.total_tokens || 0
          },
          aiCost: cost,
          requestId
        }
      }

    } catch (error) {
      const processingTime = Math.floor((Date.now() - startTime) / 1000)
      
      context.error('AI analysis failed', {
        requestId,
        userId: request.userId,
        processingTimeSeconds: processingTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
      })

      if (error instanceof RateLimitError || error instanceof CostLimitError) {
        throw error // Re-throw rate limit and cost errors as-is
      }

      throw new AIAnalysisError(
        `AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        requestId
      )
    }
  }

  /**
   * Check rate limits
   */
  private async checkRateLimits(userId: string, context: InvocationContext): Promise<void> {
    try {
      // Check global rate limit
      await this.globalRateLimiter.consume('ai-global')
      
      // Check user rate limit
      await this.userRateLimiter.consume(userId)
      
    } catch (rateLimitError: any) {
      context.warn('AI rate limit exceeded', {
        userId,
        type: rateLimitError.remainingPoints !== undefined ? 'user' : 'global',
        msBeforeNext: rateLimitError.msBeforeNext
      })
      
      throw new RateLimitError(
        'AI analysis rate limit exceeded. Please try again later.',
        rateLimitError.msBeforeNext
      )
    }
  }

  /**
   * Check cost limits
   */
  private async checkCostLimits(userId: string, context: InvocationContext): Promise<void> {
    const tracker = await this.getCostTracker(userId)
    const now = new Date()

    // Reset daily costs if needed
    if (now.getDate() !== tracker.lastReset.daily.getDate()) {
      tracker.dailyCost = 0
      tracker.lastReset.daily = now
    }

    // Reset monthly costs if needed
    if (now.getMonth() !== tracker.lastReset.monthly.getMonth()) {
      tracker.monthlyCost = 0
      tracker.lastReset.monthly = now
    }

    // Check daily limit
    if (tracker.dailyCost >= this.config.rateLimits.cost.maxDailyCost) {
      context.warn('Daily AI cost limit exceeded', {
        userId,
        dailyCost: tracker.dailyCost,
        limit: this.config.rateLimits.cost.maxDailyCost
      })
      throw new CostLimitError('Daily AI analysis cost limit exceeded')
    }

    // Check monthly limit
    if (tracker.monthlyCost >= this.config.rateLimits.cost.maxMonthlyCost) {
      context.warn('Monthly AI cost limit exceeded', {
        userId,
        monthlyCost: tracker.monthlyCost,
        limit: this.config.rateLimits.cost.maxMonthlyCost
      })
      throw new CostLimitError('Monthly AI analysis cost limit exceeded')
    }
  }

  /**
   * Make AI API request with retries
   */
  private async makeAIRequest(
    prompt: string,
    requestId: string,
    context: InvocationContext
  ): Promise<any> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.config.retryConfig.maxRetries; attempt++) {
      try {
        const response = await axios.post(
          this.config.apiUrl,
          {
            model: this.config.model,
            messages: [
              {
                role: 'system',
                content: 'You are an expert HR professional and resume analyst. Provide thorough, objective analysis in valid JSON format only. Do not include any text outside the JSON structure.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
            top_p: 0.9,
            frequency_penalty: 0.1,
            presence_penalty: 0.1
          },
          {
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json',
              'X-Request-ID': requestId
            },
            timeout: this.config.timeout,
            validateStatus: (status) => status < 500 // Retry on 5xx errors only
          }
        )

        return response

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        const isRetryable = this.isRetryableError(error)
        const isLastAttempt = attempt === this.config.retryConfig.maxRetries

        context.warn(`AI API request failed (attempt ${attempt + 1})`, {
          requestId,
          error: lastError.message,
          isRetryable,
          isLastAttempt,
          status: axios.isAxiosError(error) ? error.response?.status : undefined
        })

        if (!isRetryable || isLastAttempt) {
          break
        }

        // Calculate exponential backoff delay
        const delay = Math.min(
          this.config.retryConfig.baseDelay * Math.pow(2, attempt),
          this.config.retryConfig.maxDelay
        )
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // Handle specific error types
    if (axios.isAxiosError(lastError)) {
      if (lastError.response?.status === 429) {
        throw new RateLimitError('AI API rate limit exceeded')
      }
      if (lastError.response?.status === 401 || lastError.response?.status === 403) {
        throw new AIAnalysisError('AI API authentication failed', requestId)
      }
      if (lastError.code === 'ECONNABORTED') {
        throw new AIAnalysisError('AI API request timeout', requestId)
      }
    }

    throw new AIAnalysisError(
      `AI API request failed after ${this.config.retryConfig.maxRetries + 1} attempts: ${lastError?.message}`,
      requestId
    )
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      // Retry on 5xx errors and timeout
      return (status && status >= 500) || error.code === 'ECONNABORTED'
    }
    return false
  }

  /**
   * Build analysis prompt
   */
  private buildAnalysisPrompt(resumeText: string, role: any): string {
    const requiredSkills = role.skills.filter((s: any) => s.isRequired)
    const importantSkills = role.skills.filter((s: any) => s.weight >= 7 && !s.isRequired)
    const niceToHaveSkills = role.skills.filter((s: any) => s.weight < 7)

    return `
ROLE ANALYSIS REQUEST

JOB ROLE: ${role.title}
DEPARTMENT: ${role.department || 'Not specified'}
DESCRIPTION: ${role.description || 'Not provided'}

REQUIRED SKILLS (Must-have, Weight 10):
${requiredSkills.map((s: any) => `- ${s.skillName}`).join('\n') || 'None specified'}

IMPORTANT SKILLS (Weight 7-9):
${importantSkills.map((s: any) => `- ${s.skillName} (Weight: ${s.weight})`).join('\n') || 'None specified'}

NICE-TO-HAVE SKILLS (Weight 1-6):
${niceToHaveSkills.map((s: any) => `- ${s.skillName} (Weight: ${s.weight})`).join('\n') || 'None specified'}

CUSTOM EVALUATION QUESTIONS:
${role.questions.map((q: any) => `- ${q.questionText} (Weight: ${q.weight})`).join('\n') || 'None specified'}

RESUME TO ANALYZE:
${resumeText.substring(0, 50000)} ${resumeText.length > 50000 ? '...[truncated]' : ''}

ANALYSIS REQUIREMENTS:
Provide a comprehensive analysis in this exact JSON format:

{
  "overall_score": 0-100,
  "technical_score": 0-100,
  "experience_score": 0-100,
  "education_score": 0-100,
  "skills_score": 0-100,
  "culture_fit_score": 0-100,
  "executive_summary": "2-3 sentence summary",
  "detailed_analysis": "comprehensive paragraph",
  "top_strengths": ["strength1", "strength2", "strength3"],
  "concerns_gaps": ["concern1", "concern2"],
  "red_flags": ["flag1"] or [],
  "standout_achievements": ["achievement1", "achievement2"],
  "interview_questions": ["question1", "question2", "question3"],
  "recommendation": "accept|maybe|reject",
  "recommendation_reason": "clear explanation",
  "matched_skills": {"skill": "evidence"},
  "missing_required_skills": ["skill1"] or []
}

RESPONSE FORMAT: Return ONLY valid JSON. No additional text.
`.trim()
  }

  /**
   * Validate prompt size
   */
  private validatePrompt(prompt: string, context: InvocationContext): void {
    const maxPromptSize = 100000 // 100KB
    if (prompt.length > maxPromptSize) {
      context.error('Prompt too large', {
        promptSize: prompt.length,
        maxSize: maxPromptSize
      })
      throw new AIAnalysisError('Resume content too large for analysis')
    }
  }

  /**
   * Parse AI response
   */
  private parseAIResponse(apiResponse: any, context: InvocationContext): Omit<AIAnalysisResponse, 'metadata'> {
    try {
      const content = apiResponse.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('No content in AI response')
      }

      // Clean and parse JSON
      let cleanedContent = content.trim()
      cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      
      const firstBrace = cleanedContent.indexOf('{')
      const lastBrace = cleanedContent.lastIndexOf('}')
      
      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('No valid JSON found in response')
      }
      
      const jsonString = cleanedContent.substring(firstBrace, lastBrace + 1)
      const parsed = JSON.parse(jsonString)

      // Validate and sanitize response
      return {
        overallScore: Math.max(0, Math.min(100, parsed.overall_score || 0)),
        technicalScore: Math.max(0, Math.min(100, parsed.technical_score || 0)),
        experienceScore: Math.max(0, Math.min(100, parsed.experience_score || 0)),
        educationScore: Math.max(0, Math.min(100, parsed.education_score || 0)),
        skillsScore: Math.max(0, Math.min(100, parsed.skills_score || 0)),
        cultureFitScore: Math.max(0, Math.min(100, parsed.culture_fit_score || 0)),
        executiveSummary: (parsed.executive_summary || 'No summary provided').substring(0, 1000),
        detailedAnalysis: (parsed.detailed_analysis || 'No analysis provided').substring(0, 5000),
        topStrengths: Array.isArray(parsed.top_strengths) ? parsed.top_strengths.slice(0, 5) : [],
        concernsGaps: Array.isArray(parsed.concerns_gaps) ? parsed.concerns_gaps.slice(0, 5) : [],
        redFlags: Array.isArray(parsed.red_flags) ? parsed.red_flags.slice(0, 3) : [],
        standoutAchievements: Array.isArray(parsed.standout_achievements) ? parsed.standout_achievements.slice(0, 5) : [],
        interviewQuestions: Array.isArray(parsed.interview_questions) ? parsed.interview_questions.slice(0, 10) : [],
        recommendation: ['accept', 'maybe', 'reject'].includes(parsed.recommendation) ? parsed.recommendation : 'maybe',
        recommendationReason: (parsed.recommendation_reason || 'No reason provided').substring(0, 1000),
        matchedSkills: typeof parsed.matched_skills === 'object' ? parsed.matched_skills : {},
        missingRequiredSkills: Array.isArray(parsed.missing_required_skills) ? parsed.missing_required_skills.slice(0, 20) : []
      }

    } catch (error) {
      context.error('Failed to parse AI response', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responsePreview: apiResponse.choices?.[0]?.message?.content?.substring(0, 200)
      })
      
      throw new AIAnalysisError('Failed to parse AI analysis response')
    }
  }

  /**
   * Calculate API cost
   */
  private calculateCost(usage: any): number {
    if (!usage) return 0

    // Hyperbolic.xyz pricing (approximate)
    const inputTokenCost = 0.000001  // $0.000001 per input token
    const outputTokenCost = 0.000002 // $0.000002 per output token

    const inputTokens = usage.prompt_tokens || 0
    const outputTokens = usage.completion_tokens || 0

    return (inputTokens * inputTokenCost) + (outputTokens * outputTokenCost)
  }

  /**
   * Get or create cost tracker for user
   */
  private async getCostTracker(userId: string): Promise<CostTracker> {
    let tracker = this.costTrackers.get(userId)
    
    if (!tracker) {
      // Try to load from database
      tracker = await this.loadCostTrackerFromDB(userId)
      this.costTrackers.set(userId, tracker)
    }
    
    return tracker
  }

  /**
   * Load cost tracker from database
   */
  private async loadCostTrackerFromDB(userId: string): Promise<CostTracker> {
    try {
      const dbManager = getDbManager()
      const result = await dbManager.executeQuery(
        `SELECT dailyCost, monthlyCost, requestCount, lastResetDaily, lastResetMonthly
         FROM user_ai_costs WHERE userId = @userId`,
        { userId }
      )

      if (result.length > 0) {
        const data = result[0]
        return {
          userId,
          dailyCost: data.dailyCost || 0,
          monthlyCost: data.monthlyCost || 0,
          requestCount: data.requestCount || 0,
          lastReset: {
            daily: new Date(data.lastResetDaily || Date.now()),
            monthly: new Date(data.lastResetMonthly || Date.now())
          }
        }
      }
    } catch (error) {
      // If table doesn't exist or query fails, create new tracker
    }

    return {
      userId,
      dailyCost: 0,
      monthlyCost: 0,
      requestCount: 0,
      lastReset: {
        daily: new Date(),
        monthly: new Date()
      }
    }
  }

  /**
   * Update cost tracking
   */
  private async updateCostTracking(
    userId: string,
    cost: number,
    context: InvocationContext
  ): Promise<void> {
    try {
      const tracker = this.costTrackers.get(userId)
      if (!tracker) return

      tracker.dailyCost += cost
      tracker.monthlyCost += cost
      tracker.requestCount += 1

      // Persist to database
      const dbManager = getDbManager()
      await dbManager.executeQuery(
        `MERGE user_ai_costs AS target
         USING (SELECT @userId as userId) AS source ON (target.userId = source.userId)
         WHEN MATCHED THEN 
           UPDATE SET dailyCost = @dailyCost, monthlyCost = @monthlyCost, 
                     requestCount = @requestCount, lastResetDaily = @lastResetDaily,
                     lastResetMonthly = @lastResetMonthly, updatedAt = GETDATE()
         WHEN NOT MATCHED THEN
           INSERT (userId, dailyCost, monthlyCost, requestCount, lastResetDaily, lastResetMonthly, createdAt)
           VALUES (@userId, @dailyCost, @monthlyCost, @requestCount, @lastResetDaily, @lastResetMonthly, GETDATE());`,
        {
          userId,
          dailyCost: tracker.dailyCost,
          monthlyCost: tracker.monthlyCost,
          requestCount: tracker.requestCount,
          lastResetDaily: tracker.lastReset.daily,
          lastResetMonthly: tracker.lastReset.monthly
        }
      )

      context.log('Cost tracking updated', {
        userId,
        costIncrement: cost,
        dailyTotal: tracker.dailyCost,
        monthlyTotal: tracker.monthlyCost,
        requestCount: tracker.requestCount
      })

    } catch (error) {
      context.error('Failed to update cost tracking', {
        userId,
        cost,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Get user cost summary
   */
  async getUserCostSummary(userId: string): Promise<{
    daily: { cost: number; limit: number; remaining: number }
    monthly: { cost: number; limit: number; remaining: number }
    requestCount: number
  }> {
    const tracker = await this.getCostTracker(userId)
    
    return {
      daily: {
        cost: tracker.dailyCost,
        limit: this.config.rateLimits.cost.maxDailyCost,
        remaining: Math.max(0, this.config.rateLimits.cost.maxDailyCost - tracker.dailyCost)
      },
      monthly: {
        cost: tracker.monthlyCost,
        limit: this.config.rateLimits.cost.maxMonthlyCost,
        remaining: Math.max(0, this.config.rateLimits.cost.maxMonthlyCost - tracker.monthlyCost)
      },
      requestCount: tracker.requestCount
    }
  }
}

// Custom error classes
export class AIAnalysisError extends Error {
  constructor(message: string, public requestId?: string) {
    super(message)
    this.name = 'AIAnalysisError'
  }
}

export class RateLimitError extends Error {
  constructor(message: string, public retryAfter?: number) {
    super(message)
    this.name = 'RateLimitError'
  }
}

export class CostLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CostLimitError'
  }
}

// Export singleton
export const enhancedAIService = new EnhancedAIService()

export type { AIAnalysisRequest, AIAnalysisResponse }