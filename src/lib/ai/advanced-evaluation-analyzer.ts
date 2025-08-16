/**
 * Advanced Evaluation Analyzer with Modular Scoring System
 * Implements the sophisticated scoring formula: Base (0-70) + Bonuses (0-30) - Penalties (0-20) = Final (0-100)
 */

import { RoleRequirement } from '@/lib/db-secure'

export interface BonusConfiguration {
  preferredEducation?: {
    enabled: boolean
    specificUniversities?: string[]
    universityCategories?: string[]
  }
  preferredCompanies?: {
    enabled: boolean
    specificCompanies?: string[]
    companyCategories?: string[]
  }
  relatedProjects?: {
    enabled: boolean
    description: string
  }
  relatedCertifications?: {
    enabled: boolean
    certificationsList: string[]
  }
}

export interface PenaltyConfiguration {
  jobHopping?: {
    enabled: boolean
    sensitivity: 'strict' | 'moderate' | 'lenient'
  }
  employmentGaps?: {
    enabled: boolean
    threshold: '6months' | '1year' | '2years'
  }
}

export interface RoleConfiguration {
  id: string
  title: string
  description: string
  educationRequirements: string
  experienceRequirements: string
  skills?: Array<{
    skillName: string
    weight: number
    isRequired: boolean
    category?: string
  }>
  questions?: Array<{
    questionText: string
    weight: number
    category?: string
  }>
  bonusConfig?: BonusConfiguration
  penaltyConfig?: PenaltyConfiguration
}

export interface EvaluationResult {
  evaluationId: string
  candidateId: string
  roleId: string
  timestamp: string
  
  finalScore: number
  percentile: number
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  hiringRecommendation: 'PASS' | 'MAYBE' | 'CONSIDER' | 'RECOMMEND' | 'STRONGLY_RECOMMEND'
  
  executiveSummary: {
    oneLine: string
    keyStrengths: string[]
    keyConcerns: string[]
    overallFit: string
  }
  
  scoreBreakdown: {
    baseScore: {
      total: number
      maxPossible: number
      percentage: number
      components: {
        education?: { score: number; max: number; justification: string }
        experience?: { score: number; max: number; justification: string }
        skills?: { score: number; max: number; justification: string }
        questions?: { score: number; max: number; justification: string }
        generalFit?: { score: number; max: number; justification: string }
      }
    }
    bonuses?: {
      total: number
      maxPossible: number
      percentage: number
      components: {
        preferredEducation?: { matched: boolean; score: number; evidence: string; confidence: string }
        preferredCompanies?: { matched: boolean; score: number; evidence: string; confidence: string }
        relatedProjects?: { rating: number; score: number; evidence: string; confidence: string }
        relatedCertifications?: { rating: number; score: number; evidence: string; confidence: string }
      }
      justification: string
    }
    penalties?: {
      total: number
      maxPossible: number
      components: {
        jobHopping?: { severity: string; score: number; evidence: string; confidence: string }
        employmentGaps?: { severity: string; score: number; evidence: string; confidence: string }
      }
      justification: string
    }
  }
  
  detailedAnalysis: {
    educationAnalysis: any
    experienceAnalysis: any
    skillsAnalysis?: any
    questionsAnalysis?: any
  }
  
  recommendations: {
    hiringDecision: {
      recommendation: string
      confidence: number
      reasoning: string
    }
    interviewFocus: string[]
    offerStrategy?: string[]
    redFlagsToVerify: string[]
  }
  
  metadata: {
    aiModel: string
    evaluationVersion: string
    processingTimeMs: number
    tokensUsed: number
    confidenceFactors: {
      resumeQuality: string
      informationCompleteness: string
      parsingAccuracy: string
    }
  }
}

export class AdvancedEvaluationAnalyzer {
  private apiKey: string
  private apiUrl = 'https://api.hyperbolic.xyz/v1/chat/completions'
  private lastRequestTime: Map<string, number> = new Map()
  private requestQueue: Map<string, number> = new Map()

  constructor() {
    this.apiKey = process.env.HYPERBOLIC_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('Hyperbolic API key not configured - please set HYPERBOLIC_API_KEY environment variable')
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
   * Analyze a resume with the sophisticated scoring system
   */
  async analyzeResume(
    userId: string,
    resumeText: string,
    role: RoleConfiguration
  ): Promise<EvaluationResult> {
    const startTime = Date.now()
    await this.enforceRateLimit(userId)

    const prompt = this.buildAdvancedPrompt(resumeText, role)
    
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-oss-120b',
          messages: [
            {
              role: 'system',
              content: this.getAdvancedSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 3000,
          temperature: 0.15,
          top_p: 0.85,
          stream: false
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`AI API error: ${response.status} - ${error}`)
      }

      const data = await response.json()
      const aiResponse = data.choices[0].message.content
      const processingTime = Date.now() - startTime

      // Parse and enrich the AI response
      const result = this.parseAdvancedAIResponse(aiResponse, role, processingTime)
      
      return result
    } catch (error) {
      console.error('Advanced AI analysis error:', error)
      throw error
    }
  }

  /**
   * Build the advanced analysis prompt based on configuration
   */
  private buildAdvancedPrompt(resumeText: string, role: RoleConfiguration): string {
    const optimizedResume = this.optimizeResumeText(resumeText)
    
    let prompt = `Analyze this resume for the "${role.title}" position using our advanced scoring system.

ROLE OVERVIEW:
${role.description}

BASE REQUIREMENTS (0-70 points):
Education: ${role.educationRequirements}
Experience: ${role.experienceRequirements}`

    // Add skills if provided
    if (role.skills && role.skills.length > 0) {
      prompt += `\n\nSKILLS (evaluate each):
${role.skills.map(s => `• ${s.skillName} [Weight: ${s.weight}/10]${s.isRequired ? ' [REQUIRED]' : ''}`).join('\n')}`
    }

    // Add questions if provided
    if (role.questions && role.questions.length > 0) {
      prompt += `\n\nEVALUATION QUESTIONS (answer based on resume):
${role.questions.map(q => `• ${q.questionText} [Weight: ${q.weight}/10]`).join('\n')}`
    }

    // Add bonus configuration if enabled
    if (role.bonusConfig) {
      prompt += `\n\nQUALITY BONUSES (look for excellence):`
      
      if (role.bonusConfig.preferredEducation?.enabled) {
        if (role.bonusConfig.preferredEducation.specificUniversities?.length) {
          prompt += `\n• preferred_education: [${role.bonusConfig.preferredEducation.specificUniversities.join(', ')}]`
        }
        if (role.bonusConfig.preferredEducation.universityCategories?.length) {
          prompt += `\n• university_categories: [${role.bonusConfig.preferredEducation.universityCategories.join(', ')}]`
        }
      }
      
      if (role.bonusConfig.preferredCompanies?.enabled) {
        if (role.bonusConfig.preferredCompanies.specificCompanies?.length) {
          prompt += `\n• preferred_companies: [${role.bonusConfig.preferredCompanies.specificCompanies.join(', ')}]`
        }
        if (role.bonusConfig.preferredCompanies.companyCategories?.length) {
          prompt += `\n• company_categories: [${role.bonusConfig.preferredCompanies.companyCategories.join(', ')}]`
        }
      }
      
      if (role.bonusConfig.relatedProjects?.enabled) {
        prompt += `\n• related_projects: "${role.bonusConfig.relatedProjects.description}" (1-10)`
      }
      
      if (role.bonusConfig.relatedCertifications?.enabled) {
        prompt += `\n• related_certifications: [${role.bonusConfig.relatedCertifications.certificationsList.join(', ')}] (1-10)`
      }
    }

    // Add penalty configuration if enabled
    if (role.penaltyConfig) {
      prompt += `\n\nRISK FACTORS (red flags to consider):`
      
      if (role.penaltyConfig.jobHopping?.enabled) {
        const thresholds = {
          strict: '>20% short tenures',
          moderate: '>30% short tenures',
          lenient: '>50% short tenures'
        }
        prompt += `\n• job_hopping: ${thresholds[role.penaltyConfig.jobHopping.sensitivity]} concern`
      }
      
      if (role.penaltyConfig.employmentGaps?.enabled) {
        const thresholds = {
          '6months': '> 6 months',
          '1year': '> 1 year',
          '2years': '> 2 years'
        }
        prompt += `\n• employment_gaps: gaps ${thresholds[role.penaltyConfig.employmentGaps.threshold]}`
      }
    }

    prompt += `\n\nRESUME TO ANALYZE:
${optimizedResume}

Provide comprehensive analysis using the sophisticated scoring system.`

    return prompt
  }

  /**
   * Advanced system prompt for sophisticated evaluation
   */
  private getAdvancedSystemPrompt(): string {
    return `You are an expert HR AI evaluator with 20+ years of experience. Your job is to provide CRITICAL and HONEST evaluations that help companies make the right hiring decisions.

EVALUATION PHILOSOPHY:
- Read the ENTIRE resume first to understand the candidate holistically
- Consider the candidate's full journey, not just checkboxes
- Be critical but fair - no sugar-coating, but recognize genuine excellence
- A score of 100 should be nearly impossible (perfect candidate)
- Most good candidates score 60-75, exceptional ones 75-85, unicorns 85+

SCORING FRAMEWORK:
Base (0-70) + Bonuses (0-30) - Penalties (0-20) = Final (0-100)

CRITICAL EVALUATION INSTRUCTIONS:
1. First, read the ENTIRE resume to understand the candidate's story
2. Look for patterns: career progression, consistency, growth trajectory
3. Identify what makes this candidate unique (positive or negative)
4. Consider intangibles: communication quality, attention to detail, passion
5. Ask yourself: "Would I hire this person for this role?"
6. Then assign scores based on your holistic assessment

IMPORTANT SCORING NOTES:
- Don't just add up points mechanically
- If something feels off despite good credentials, reflect that in the score
- If someone shows exceptional potential despite gaps, recognize that
- Consider industry context (startup vs enterprise, junior vs senior)
- Factor in supply/demand for this role type

FINAL SCORE CALIBRATION:
After calculating base + bonus - penalty, ask yourself:
- Does this score truly reflect this candidate's fit?
- Am I being too generous or too harsh?
- Would I defend this score to a hiring manager?
Adjust the final score by ±5 points if needed to reflect your honest assessment.

Always respond with valid JSON in the exact format specified. Include detailed justifications for all scores and decisions.

Remember: Your 'final_score' is your HONEST PROFESSIONAL OPINION considering everything, not just mechanical calculation. Be the critical filter that helps companies find the RIGHT candidates, not just qualified ones.`
  }

  /**
   * Optimize resume text for better analysis
   */
  private optimizeResumeText(text: string): string {
    const maxLength = 6000
    
    if (text.length <= maxLength) {
      return text.trim()
    }

    // Try to extract key sections if text is too long
    const sections = this.extractSections(text)
    
    if (sections.contact || sections.skills || sections.experience) {
      const prioritized = [
        sections.contact,
        sections.skills, 
        sections.experience?.substring(0, maxLength * 0.5),
        sections.education?.substring(0, maxLength * 0.2),
        sections.summary?.substring(0, maxLength * 0.1)
      ].filter(Boolean).join('\n\n')
      
      return prioritized.substring(0, maxLength)
    }
    
    return text.substring(0, maxLength).trim()
  }

  /**
   * Basic section extraction for resume text
   */
  private extractSections(text: string) {
    const sections: any = {}
    
    const patterns = {
      contact: /(?:contact|email|phone|address|linkedin|github)[\s\S]*?(?=\n\n|\n[A-Z]|$)/i,
      summary: /(?:summary|objective|profile|about me)[\s\S]*?(?=\n\n|\n[A-Z]|$)/i,
      experience: /(?:experience|employment|work history|professional)[\s\S]*?(?=education|skills|$)/i,
      education: /(?:education|academic|qualification|degree)[\s\S]*?(?=\n\n|\n[A-Z]|$)/i,
      skills: /(?:skills|technical|competencies|expertise)[\s\S]*?(?=\n\n|\n[A-Z]|$)/i
    }
    
    for (const [section, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern)
      if (match) {
        sections[section] = match[0].trim()
      }
    }
    
    return sections
  }

  /**
   * Parse AI response into sophisticated evaluation result
   */
  private parseAdvancedAIResponse(aiResponse: string, role: RoleConfiguration, processingTime: number): EvaluationResult {
    try {
      const cleanResponse = aiResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      const parsed = JSON.parse(cleanResponse)
      
      // Calculate percentile based on score distribution
      const percentile = this.calculatePercentile(parsed.final_score || parsed.finalScore || 0)
      
      // Determine confidence level
      const confidenceLevel = this.determineConfidenceLevel(parsed, role)
      
      // Generate hiring recommendation
      const hiringRecommendation = this.determineHiringRecommendation(parsed.final_score || parsed.finalScore || 0)
      
      // Build structured result
      const result: EvaluationResult = {
        evaluationId: crypto.randomUUID(),
        candidateId: crypto.randomUUID(),
        roleId: role.id,
        timestamp: new Date().toISOString(),
        
        finalScore: parsed.final_score || parsed.finalScore || 0,
        percentile,
        confidenceLevel,
        hiringRecommendation,
        
        executiveSummary: {
          oneLine: parsed.executive_summary?.one_line || parsed.executiveSummary?.oneLine || `Candidate scored ${parsed.final_score || 0}% for ${role.title} position`,
          keyStrengths: parsed.executive_summary?.key_strengths || parsed.executiveSummary?.keyStrengths || [],
          keyConcerns: parsed.executive_summary?.key_concerns || parsed.executiveSummary?.keyConcerns || [],
          overallFit: parsed.executive_summary?.overall_fit || parsed.executiveSummary?.overallFit || 'Standard evaluation'
        },
        
        scoreBreakdown: {
          baseScore: {
            total: parsed.score_breakdown?.base_score?.total || parsed.scoreBreakdown?.baseScore?.total || parsed.base_score || 0,
            maxPossible: 70,
            percentage: ((parsed.score_breakdown?.base_score?.total || parsed.base_score || 0) / 70) * 100,
            components: this.extractBaseComponents(parsed)
          },
          ...(this.hasBonusConfig(role) && {
            bonuses: {
              total: parsed.score_breakdown?.bonuses?.total || parsed.bonuses?.overall_bonus_estimate || 0,
              maxPossible: 30,
              percentage: ((parsed.score_breakdown?.bonuses?.total || parsed.bonuses?.overall_bonus_estimate || 0) / 30) * 100,
              components: this.extractBonusComponents(parsed),
              justification: parsed.score_breakdown?.bonuses?.justification || parsed.bonuses?.bonus_reasoning || ''
            }
          }),
          ...(this.hasPenaltyConfig(role) && {
            penalties: {
              total: parsed.score_breakdown?.penalties?.total || parsed.penalties?.overall_penalty_estimate || 0,
              maxPossible: 20,
              components: this.extractPenaltyComponents(parsed),
              justification: parsed.score_breakdown?.penalties?.justification || parsed.penalties?.penalty_reasoning || ''
            }
          })
        },
        
        detailedAnalysis: {
          educationAnalysis: parsed.detailed_analysis?.education_analysis || {},
          experienceAnalysis: parsed.detailed_analysis?.experience_analysis || {},
          ...(role.skills && { skillsAnalysis: parsed.detailed_analysis?.skills_analysis || {} }),
          ...(role.questions && { questionsAnalysis: parsed.detailed_analysis?.questions_analysis || {} })
        },
        
        recommendations: {
          hiringDecision: {
            recommendation: parsed.recommendations?.hiring_decision?.recommendation || hiringRecommendation,
            confidence: parsed.recommendations?.hiring_decision?.confidence || 75,
            reasoning: parsed.recommendations?.hiring_decision?.reasoning || 'Standard evaluation based on score'
          },
          interviewFocus: parsed.recommendations?.interview_focus || [],
          ...(parsed.final_score >= 80 && { offerStrategy: parsed.recommendations?.offer_strategy || [] }),
          redFlagsToVerify: parsed.recommendations?.red_flags_to_verify || []
        },
        
        metadata: {
          aiModel: 'gpt-oss-120b',
          evaluationVersion: '2.0',
          processingTimeMs: processingTime,
          tokensUsed: this.estimateTokens(aiResponse),
          confidenceFactors: {
            resumeQuality: parsed.metadata?.confidence_factors?.resume_quality || 'MEDIUM',
            informationCompleteness: this.assessInformationCompleteness(role),
            parsingAccuracy: 'HIGH'
          }
        }
      }
      
      return result
    } catch (error) {
      console.error('Failed to parse advanced AI response:', error, aiResponse)
      
      // Return minimal valid structure if parsing fails
      return this.createFallbackResult(role, processingTime)
    }
  }

  private extractBaseComponents(parsed: any) {
    const components: any = {}
    
    if (parsed.score_breakdown?.base_score?.components || parsed.detailed_analysis) {
      const baseComponents = parsed.score_breakdown?.base_score?.components || {}
      
      if (baseComponents.education || parsed.detailed_analysis?.education_analysis) {
        components.education = {
          score: baseComponents.education?.score || 0,
          max: baseComponents.education?.max || 10,
          justification: baseComponents.education?.justification || 'Education evaluation'
        }
      }
      
      if (baseComponents.experience || parsed.detailed_analysis?.experience_analysis) {
        components.experience = {
          score: baseComponents.experience?.score || 0,
          max: baseComponents.experience?.max || 10,
          justification: baseComponents.experience?.justification || 'Experience evaluation'
        }
      }
      
      if (baseComponents.skills || parsed.detailed_analysis?.skills_analysis) {
        components.skills = {
          score: baseComponents.skills?.score || 0,
          max: baseComponents.skills?.max || 40,
          justification: baseComponents.skills?.justification || 'Skills evaluation'
        }
      }
      
      if (baseComponents.questions || parsed.detailed_analysis?.questions_analysis) {
        components.questions = {
          score: baseComponents.questions?.score || 0,
          max: baseComponents.questions?.max || 10,
          justification: baseComponents.questions?.justification || 'Questions evaluation'
        }
      }
      
      if (baseComponents.general_fit || baseComponents.generalFit) {
        components.generalFit = {
          score: baseComponents.general_fit?.score || baseComponents.generalFit?.score || 0,
          max: baseComponents.general_fit?.max || baseComponents.generalFit?.max || 50,
          justification: baseComponents.general_fit?.justification || baseComponents.generalFit?.justification || 'General fit evaluation'
        }
      }
    }
    
    return components
  }

  private extractBonusComponents(parsed: any) {
    const components: any = {}
    const bonuses = parsed.bonuses || parsed.score_breakdown?.bonuses?.components || {}
    
    if (bonuses.preferred_education !== undefined || bonuses.preferredEducation !== undefined) {
      components.preferredEducation = {
        matched: bonuses.preferred_education || bonuses.preferredEducation?.matched || false,
        score: bonuses.preferredEducation?.score || 0,
        evidence: bonuses.preferredEducation?.evidence || 'Education check',
        confidence: bonuses.preferredEducation?.confidence || 'MEDIUM'
      }
    }
    
    if (bonuses.preferred_companies !== undefined || bonuses.preferredCompanies !== undefined) {
      components.preferredCompanies = {
        matched: bonuses.preferred_companies || bonuses.preferredCompanies?.matched || false,
        score: bonuses.preferredCompanies?.score || 0,
        evidence: bonuses.preferredCompanies?.evidence || 'Company check',
        confidence: bonuses.preferredCompanies?.confidence || 'MEDIUM'
      }
    }
    
    if (bonuses.related_projects !== undefined || bonuses.relatedProjects !== undefined) {
      components.relatedProjects = {
        rating: bonuses.related_projects || bonuses.relatedProjects?.rating || 0,
        score: bonuses.relatedProjects?.score || 0,
        evidence: bonuses.relatedProjects?.evidence || 'Project evaluation',
        confidence: bonuses.relatedProjects?.confidence || 'MEDIUM'
      }
    }
    
    if (bonuses.related_certifications !== undefined || bonuses.relatedCertifications !== undefined) {
      components.relatedCertifications = {
        rating: bonuses.related_certifications || bonuses.relatedCertifications?.rating || 0,
        score: bonuses.relatedCertifications?.score || 0,
        evidence: bonuses.relatedCertifications?.evidence || 'Certification evaluation',
        confidence: bonuses.relatedCertifications?.confidence || 'MEDIUM'
      }
    }
    
    return components
  }

  private extractPenaltyComponents(parsed: any) {
    const components: any = {}
    const penalties = parsed.penalties || parsed.score_breakdown?.penalties?.components || {}
    
    if (penalties.job_hopping !== undefined || penalties.jobHopping !== undefined) {
      components.jobHopping = {
        severity: penalties.job_hopping || penalties.jobHopping?.severity || 'none',
        score: penalties.jobHopping?.score || 0,
        evidence: penalties.jobHopping?.evidence || 'Job stability check',
        confidence: penalties.jobHopping?.confidence || 'MEDIUM'
      }
    }
    
    if (penalties.employment_gaps !== undefined || penalties.employmentGaps !== undefined) {
      components.employmentGaps = {
        severity: penalties.employment_gaps || penalties.employmentGaps?.severity || 'none',
        score: penalties.employmentGaps?.score || 0,
        evidence: penalties.employmentGaps?.evidence || 'Employment gap check',
        confidence: penalties.employmentGaps?.confidence || 'MEDIUM'
      }
    }
    
    return components
  }

  private hasBonusConfig(role: RoleConfiguration): boolean {
    if (!role.bonusConfig) return false
    
    return !!(
      role.bonusConfig.preferredEducation?.enabled ||
      role.bonusConfig.preferredCompanies?.enabled ||
      role.bonusConfig.relatedProjects?.enabled ||
      role.bonusConfig.relatedCertifications?.enabled
    )
  }

  private hasPenaltyConfig(role: RoleConfiguration): boolean {
    if (!role.penaltyConfig) return false
    
    return !!(
      role.penaltyConfig.jobHopping?.enabled ||
      role.penaltyConfig.employmentGaps?.enabled
    )
  }

  private calculatePercentile(score: number): number {
    // Score distribution targets from design document
    if (score >= 95) return 99
    if (score >= 90) return 95
    if (score >= 85) return 85
    if (score >= 80) return 75
    if (score >= 75) return 60
    if (score >= 70) return 45
    if (score >= 65) return 30
    if (score >= 60) return 20
    if (score >= 55) return 10
    return 5
  }

  private determineConfidenceLevel(parsed: any, role: RoleConfiguration): 'LOW' | 'MEDIUM' | 'HIGH' {
    let confidenceScore = 0
    
    // Data completeness
    if (role.skills && role.skills.length > 0) confidenceScore += 1
    if (role.questions && role.questions.length > 0) confidenceScore += 1
    if (this.hasBonusConfig(role)) confidenceScore += 1
    
    // AI response quality
    if (parsed.detailed_analysis) confidenceScore += 1
    if (parsed.recommendations) confidenceScore += 1
    
    if (confidenceScore >= 4) return 'HIGH'
    if (confidenceScore >= 2) return 'MEDIUM'
    return 'LOW'
  }

  private determineHiringRecommendation(score: number): 'PASS' | 'MAYBE' | 'CONSIDER' | 'RECOMMEND' | 'STRONGLY_RECOMMEND' {
    if (score >= 90) return 'STRONGLY_RECOMMEND'
    if (score >= 80) return 'RECOMMEND'
    if (score >= 70) return 'CONSIDER'
    if (score >= 60) return 'MAYBE'
    return 'PASS'
  }

  private assessInformationCompleteness(role: RoleConfiguration): string {
    let completeness = 0
    if (role.skills && role.skills.length > 0) completeness++
    if (role.questions && role.questions.length > 0) completeness++
    if (this.hasBonusConfig(role)) completeness++
    if (this.hasPenaltyConfig(role)) completeness++
    
    if (completeness >= 3) return 'HIGH'
    if (completeness >= 2) return 'MEDIUM'
    return 'LOW'
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.round(text.length / 4)
  }

  private createFallbackResult(role: RoleConfiguration, processingTime: number): EvaluationResult {
    return {
      evaluationId: crypto.randomUUID(),
      candidateId: crypto.randomUUID(),
      roleId: role.id,
      timestamp: new Date().toISOString(),
      
      finalScore: 0,
      percentile: 5,
      confidenceLevel: 'LOW',
      hiringRecommendation: 'PASS',
      
      executiveSummary: {
        oneLine: 'Unable to analyze resume due to parsing error',
        keyStrengths: [],
        keyConcerns: ['Analysis failed'],
        overallFit: 'Evaluation incomplete'
      },
      
      scoreBreakdown: {
        baseScore: {
          total: 0,
          maxPossible: 70,
          percentage: 0,
          components: {}
        }
      },
      
      detailedAnalysis: {
        educationAnalysis: {},
        experienceAnalysis: {}
      },
      
      recommendations: {
        hiringDecision: {
          recommendation: 'PASS',
          confidence: 0,
          reasoning: 'Analysis failed - unable to evaluate candidate'
        },
        interviewFocus: [],
        redFlagsToVerify: ['Re-run evaluation']
      },
      
      metadata: {
        aiModel: 'gpt-oss-120b',
        evaluationVersion: '2.0',
        processingTimeMs: processingTime,
        tokensUsed: 0,
        confidenceFactors: {
          resumeQuality: 'UNKNOWN',
          informationCompleteness: 'LOW',
          parsingAccuracy: 'LOW'
        }
      }
    }
  }

  /**
   * Process multiple resumes with batching
   */
  async processBatch(
    userId: string,
    resumes: Array<{ id: string; text: string }>,
    role: RoleConfiguration,
    onProgress?: (processed: number, total: number) => void
  ): Promise<Map<string, EvaluationResult>> {
    const results = new Map<string, EvaluationResult>()
    
    for (let i = 0; i < resumes.length; i++) {
      const resume = resumes[i]
      
      try {
        const result = await this.analyzeResume(userId, resume.text, role)
        result.candidateId = resume.id
        results.set(resume.id, result)
      } catch (error) {
        console.error(`Failed to analyze resume ${resume.id}:`, error)
        const fallbackResult = this.createFallbackResult(role, 0)
        fallbackResult.candidateId = resume.id
        results.set(resume.id, fallbackResult)
      }
      
      if (onProgress) {
        onProgress(i + 1, resumes.length)
      }
    }
    
    return results
  }
}