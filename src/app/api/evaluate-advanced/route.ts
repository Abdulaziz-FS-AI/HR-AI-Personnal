/**
 * Advanced Evaluation Endpoint with Sophisticated Scoring
 * Implements the new scoring system: Base (0-70) + Bonuses (0-30) - Penalties (0-20) = Final (0-100)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUserContext, logDataAccess } from '@/lib/security/user-context'
import { getUserRole, getUserRoleSkills, getUserRoleQuestions, createEvaluationResult } from '@/lib/db-secure'
import { AdvancedEvaluationAnalyzer, RoleConfiguration } from '@/lib/ai/advanced-evaluation-analyzer'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Secure user context validation
    const userContext = await requireUserContext(request)
    
    const body = await request.json()
    const { evaluationId, fileId, resumeText, roleId } = body
    
    if (!evaluationId || !fileId || !resumeText || !roleId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields',
        required: ['evaluationId', 'fileId', 'resumeText', 'roleId']
      }, { status: 400 })
    }
    
    // Get role with user-scoped access
    const role = await getUserRole(userContext.userId, roleId)
    if (!role) {
      return NextResponse.json({
        success: false,
        message: 'Role not found or access denied'
      }, { status: 404 })
    }
    
    // Get role skills and questions
    const [skills, questions] = await Promise.all([
      getUserRoleSkills(userContext.userId, roleId),
      getUserRoleQuestions(userContext.userId, roleId)
    ])
    
    // Build role configuration for evaluation
    const roleConfig: RoleConfiguration = {
      id: role.id,
      title: role.title,
      description: role.description,
      educationRequirements: role.education_requirements,
      experienceRequirements: role.experience_requirements,
      skills: skills.map(skill => ({
        skillName: skill.skill_name,
        weight: skill.weight,
        isRequired: skill.is_required,
        category: skill.skill_category
      })),
      questions: questions.map(question => ({
        questionText: question.question_text,
        weight: question.weight,
        category: question.category
      })),
      bonusConfig: role.bonus_config ? JSON.parse(role.bonus_config) : undefined,
      penaltyConfig: role.penalty_config ? JSON.parse(role.penalty_config) : undefined
    }
    
    // Initialize advanced analyzer
    const analyzer = new AdvancedEvaluationAnalyzer()
    
    // Perform sophisticated evaluation
    console.log(`🔍 Starting advanced evaluation for file ${fileId} against role ${roleId}`)
    const evaluationResult = await analyzer.analyzeResume(
      userContext.userId,
      resumeText,
      roleConfig
    )
    
    // Store result in database
    const resultId = await createEvaluationResult(userContext.userId, {
      evaluationId,
      fileId,
      overallScore: evaluationResult.finalScore,
      skillsAnalysis: evaluationResult.scoreBreakdown.baseScore.components.skills || {},
      recommendations: evaluationResult.recommendations.interviewFocus,
      redFlags: evaluationResult.recommendations.redFlagsToVerify,
      aiDecision: evaluationResult.hiringRecommendation,
      processingTime: evaluationResult.metadata.processingTimeMs,
      metadata: {
        scoreBreakdown: evaluationResult.scoreBreakdown,
        detailedAnalysis: evaluationResult.detailedAnalysis,
        executiveSummary: evaluationResult.executiveSummary,
        percentile: evaluationResult.percentile,
        confidenceLevel: evaluationResult.confidenceLevel,
        evaluationVersion: evaluationResult.metadata.evaluationVersion,
        tokensUsed: evaluationResult.metadata.tokensUsed
      }
    })
    
    // Log evaluation activity
    await logDataAccess(
      userContext.userId,
      'ADVANCED_EVALUATION',
      'evaluation_result',
      resultId,
      { 
        roleId, 
        fileId, 
        finalScore: evaluationResult.finalScore,
        recommendation: evaluationResult.hiringRecommendation,
        processingTime: evaluationResult.metadata.processingTimeMs
      }
    )
    
    console.log(`✅ Advanced evaluation completed: ${evaluationResult.finalScore}% (${evaluationResult.hiringRecommendation})`)
    
    return NextResponse.json({
      success: true,
      data: {
        resultId,
        evaluation: evaluationResult
      },
      message: 'Advanced evaluation completed successfully',
      responseTime: Date.now() - startTime
    })
    
  } catch (error) {
    console.error('Advanced evaluation error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to perform advanced evaluation',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const userContext = await requireUserContext(request)
    
    const { searchParams } = new URL(request.url)
    const roleId = searchParams.get('roleId')
    
    if (!roleId) {
      return NextResponse.json({
        success: false,
        message: 'Role ID is required'
      }, { status: 400 })
    }
    
    // Get role configuration for preview
    const role = await getUserRole(userContext.userId, roleId)
    if (!role) {
      return NextResponse.json({
        success: false,
        message: 'Role not found or access denied'
      }, { status: 404 })
    }
    
    const [skills, questions] = await Promise.all([
      getUserRoleSkills(userContext.userId, roleId),
      getUserRoleQuestions(userContext.userId, roleId)
    ])
    
    const config: RoleConfiguration = {
      id: role.id,
      title: role.title,
      description: role.description,
      educationRequirements: role.education_requirements,
      experienceRequirements: role.experience_requirements,
      skills: skills.map(skill => ({
        skillName: skill.skill_name,
        weight: skill.weight,
        isRequired: skill.is_required,
        category: skill.skill_category
      })),
      questions: questions.map(question => ({
        questionText: question.question_text,
        weight: question.weight,
        category: question.category
      })),
      bonusConfig: role.bonus_config ? JSON.parse(role.bonus_config) : undefined,
      penaltyConfig: role.penalty_config ? JSON.parse(role.penalty_config) : undefined
    }
    
    // Calculate expected scoring distribution
    const scoringPreview = {
      baseScore: {
        maxPoints: 70,
        distribution: {
          education: 10,
          experience: 10,
          skills: skills.length > 0 ? 40 : 0,
          questions: questions.length > 0 ? 10 : 0,
          generalFit: (skills.length === 0 && questions.length === 0) ? 50 : 0
        }
      },
      bonusScore: {
        maxPoints: 30,
        enabled: !!(config.bonusConfig?.preferredEducation?.enabled || 
                   config.bonusConfig?.preferredCompanies?.enabled ||
                   config.bonusConfig?.relatedProjects?.enabled ||
                   config.bonusConfig?.relatedCertifications?.enabled),
        modules: Object.keys(config.bonusConfig || {}).filter(key => 
          config.bonusConfig?.[key as keyof typeof config.bonusConfig]?.enabled
        )
      },
      penaltyScore: {
        maxPoints: 20,
        enabled: !!(config.penaltyConfig?.jobHopping?.enabled || 
                   config.penaltyConfig?.employmentGaps?.enabled),
        modules: Object.keys(config.penaltyConfig || {}).filter(key => 
          config.penaltyConfig?.[key as keyof typeof config.penaltyConfig]?.enabled
        )
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        roleConfiguration: config,
        scoringPreview,
        evaluationCapabilities: {
          sophisticatedScoring: true,
          dynamicPrompts: true,
          holisticEvaluation: true,
          evidenceBasedScoring: true,
          percentileRanking: true,
          confidenceAssessment: true
        }
      }
    })
    
  } catch (error) {
    console.error('Configuration preview error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get evaluation configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}