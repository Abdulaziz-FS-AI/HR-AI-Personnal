import axios from 'axios'

interface AIAnalysisRequest {
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
  aiModelUsed: string
  processingTimeSeconds: number
  aiCost: number
}

/**
 * Analyze resume using Hyperbolic.xyz API
 */
export async function analyzeResumeWithAI(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
  const startTime = Date.now()
  
  const apiKey = process.env.HYPERBOLIC_API_KEY
  const apiUrl = process.env.HYPERBOLIC_API_URL || 'https://api.hyperbolic.xyz/v1/chat/completions'
  
  if (!apiKey) {
    throw new Error('HYPERBOLIC_API_KEY environment variable is required')
  }

  const prompt = buildAnalysisPrompt(request.resumeText, request.role)
  
  try {
    const response = await axios.post(
      apiUrl,
      {
        model: 'meta-llama/Llama-3.1-8B-Instruct',
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
        temperature: 0.1,
        max_tokens: 4000,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 second timeout
      }
    )

    const processingTime = Math.floor((Date.now() - startTime) / 1000)
    const aiResponse = response.data.choices[0].message.content

    // Parse AI response
    const analysis = parseAIResponse(aiResponse)
    
    // Calculate cost (approximate based on token usage)
    const aiCost = calculateAICost(response.data.usage)

    return {
      ...analysis,
      aiModelUsed: 'meta-llama/Llama-3.1-8B-Instruct',
      processingTimeSeconds: processingTime,
      aiCost
    }

  } catch (error) {
    console.error('AI analysis failed:', error)
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('AI analysis timeout - request took too long')
      }
      if (error.response?.status === 429) {
        throw new Error('AI API rate limit exceeded - please retry later')
      }
      if (error.response?.status === 401) {
        throw new Error('AI API authentication failed - check API key')
      }
    }
    
    throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Build analysis prompt for AI
 */
function buildAnalysisPrompt(resumeText: string, role: any): string {
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
${resumeText}

ANALYSIS REQUIREMENTS:
Provide a comprehensive analysis in this exact JSON format (ensure all fields are present):

{
  "overall_score": 0-100,
  "technical_score": 0-100,
  "experience_score": 0-100,
  "education_score": 0-100,
  "skills_score": 0-100,
  "culture_fit_score": 0-100,
  "executive_summary": "2-3 sentence summary of candidate's profile",
  "detailed_analysis": "Comprehensive paragraph analyzing the candidate's fit for this role",
  "top_strengths": ["strength1", "strength2", "strength3"],
  "concerns_gaps": ["concern1", "concern2", "concern3"],
  "red_flags": ["flag1", "flag2"] or [],
  "standout_achievements": ["achievement1", "achievement2"],
  "interview_questions": ["question1", "question2", "question3"],
  "recommendation": "accept|maybe|reject",
  "recommendation_reason": "Clear explanation for the recommendation",
  "matched_skills": {"skill_name": "specific evidence from resume"},
  "missing_required_skills": ["missing_skill1", "missing_skill2"] or []
}

SCORING GUIDELINES:
- Overall Score: Weighted average of all factors
- Technical Score: Technical skills and competencies
- Experience Score: Relevant work experience and career progression
- Education Score: Educational background relevance
- Skills Score: Match with required and desired skills
- Culture Fit Score: Soft skills, values alignment, communication

RESPONSE FORMAT: Return ONLY valid JSON. No additional text or explanations outside the JSON structure.
`.trim()
}

/**
 * Parse AI response and validate structure
 */
function parseAIResponse(aiResponse: string): Omit<AIAnalysisResponse, 'aiModelUsed' | 'processingTimeSeconds' | 'aiCost'> {
  try {
    // Clean the response to extract JSON
    let cleanedResponse = aiResponse.trim()
    
    // Remove markdown code blocks if present
    cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    
    // Find the first { and last } to extract JSON
    const firstBrace = cleanedResponse.indexOf('{')
    const lastBrace = cleanedResponse.lastIndexOf('}')
    
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No valid JSON found in AI response')
    }
    
    const jsonString = cleanedResponse.substring(firstBrace, lastBrace + 1)
    const parsed = JSON.parse(jsonString)

    // Validate required fields and provide defaults
    return {
      overallScore: Math.max(0, Math.min(100, parsed.overall_score || 0)),
      technicalScore: Math.max(0, Math.min(100, parsed.technical_score || 0)),
      experienceScore: Math.max(0, Math.min(100, parsed.experience_score || 0)),
      educationScore: Math.max(0, Math.min(100, parsed.education_score || 0)),
      skillsScore: Math.max(0, Math.min(100, parsed.skills_score || 0)),
      cultureFitScore: Math.max(0, Math.min(100, parsed.culture_fit_score || 0)),
      executiveSummary: parsed.executive_summary || 'No summary provided',
      detailedAnalysis: parsed.detailed_analysis || 'No detailed analysis provided',
      topStrengths: Array.isArray(parsed.top_strengths) ? parsed.top_strengths : [],
      concernsGaps: Array.isArray(parsed.concerns_gaps) ? parsed.concerns_gaps : [],
      redFlags: Array.isArray(parsed.red_flags) ? parsed.red_flags : [],
      standoutAchievements: Array.isArray(parsed.standout_achievements) ? parsed.standout_achievements : [],
      interviewQuestions: Array.isArray(parsed.interview_questions) ? parsed.interview_questions : [],
      recommendation: ['accept', 'maybe', 'reject'].includes(parsed.recommendation) 
        ? parsed.recommendation 
        : 'maybe',
      recommendationReason: parsed.recommendation_reason || 'No reason provided',
      matchedSkills: typeof parsed.matched_skills === 'object' ? parsed.matched_skills : {},
      missingRequiredSkills: Array.isArray(parsed.missing_required_skills) ? parsed.missing_required_skills : []
    }

  } catch (error) {
    console.error('Failed to parse AI response:', error)
    console.error('Raw AI response:', aiResponse)
    
    // Return a default response structure
    return {
      overallScore: 0,
      technicalScore: 0,
      experienceScore: 0,
      educationScore: 0,
      skillsScore: 0,
      cultureFitScore: 0,
      executiveSummary: 'Analysis failed - unable to parse AI response',
      detailedAnalysis: 'The AI analysis could not be completed due to response parsing errors.',
      topStrengths: [],
      concernsGaps: ['AI analysis parsing failed'],
      redFlags: ['Analysis incomplete due to technical error'],
      standoutAchievements: [],
      interviewQuestions: [],
      recommendation: 'reject',
      recommendationReason: 'Analysis failed due to technical error',
      matchedSkills: {},
      missingRequiredSkills: []
    }
  }
}

/**
 * Calculate approximate AI cost based on token usage
 */
function calculateAICost(usage: any): number {
  if (!usage) return 0

  // Hyperbolic.xyz pricing (approximate)
  const inputTokenCost = 0.000001  // $0.000001 per input token
  const outputTokenCost = 0.000002 // $0.000002 per output token

  const inputTokens = usage.prompt_tokens || 0
  const outputTokens = usage.completion_tokens || 0

  return (inputTokens * inputTokenCost) + (outputTokens * outputTokenCost)
}

/**
 * Validate analysis result
 */
export function validateAnalysisResult(analysis: any): boolean {
  const requiredFields = [
    'overallScore', 'technicalScore', 'experienceScore', 'educationScore',
    'skillsScore', 'cultureFitScore', 'executiveSummary', 'detailedAnalysis',
    'recommendation', 'recommendationReason'
  ]

  return requiredFields.every(field => field in analysis && analysis[field] !== undefined)
}