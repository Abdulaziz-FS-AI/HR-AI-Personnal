/**
 * Candidate Intelligence API - Individual Candidate Analytics
 * Provides detailed candidate analysis with AI insights and market positioning
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'mssql'
import { getConnection } from '@/lib/db-secure'

interface CandidateIntelligence {
  candidate: {
    id: string
    name: string
    overallScore: number
    confidenceLevel: "HIGH" | "MEDIUM" | "LOW"
    
    scoring: {
      baseScore: number
      bonusPoints: number
      penaltyPoints: number
      finalScore: number
    }
    
    intelligence: {
      successPrediction: number
      retentionProbability: number
      performanceProjection: "EXCEED" | "MEET" | "BELOW"
      culturalFit: number
      
      marketValue: {
        salaryRange: [number, number]
        demandLevel: "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW"
        competitiveRisk: number
        negotiationLeverage: "HIGH" | "MEDIUM" | "LOW"
      }
    }
    
    evidence: {
      strengths: Array<{
        category: string
        description: string
        evidenceStrength: number
        businessImpact: string
      }>
      
      concerns: Array<{
        category: string
        description: string
        severity: "HIGH" | "MEDIUM" | "LOW"
        mitigation: string
      }>
      
      differentiators: Array<{
        factor: string
        description: string
        marketRarity: number
      }>
    }
    
    recommendations: {
      interviewFocus: string[]
      assessmentStrategy: string
      timelineUrgency: "IMMEDIATE" | "FAST_TRACK" | "STANDARD"
      negotiationStrategy: string
      onboardingConsiderations: string[]
    }
  }
  
  comparison: {
    percentileRank: number
    peerComparison: Array<{
      metric: string
      candidateValue: number
      peerAverage: number
      ranking: string
    }>
    
    uniqueValue: string
    alternativeCandidates: string[]
  }
  
  riskProfile: {
    flightRisk: number
    adaptabilityRisk: number
    teamFitRisk: number
    overallRisk: "LOW" | "MEDIUM" | "HIGH"
    mitigationStrategies: string[]
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { candidateId: string } }
) {
  try {
    const { candidateId } = params
    const { searchParams } = new URL(request.url)
    const evaluationId = searchParams.get('evaluationId')
    
    if (!candidateId) {
      return NextResponse.json(
        { error: 'Candidate ID is required' },
        { status: 400 }
      )
    }
    
    const pool = await getConnection()
    
    // Fetch candidate evaluation result
    let candidateQuery = `
      SELECT 
        er.*,
        ef.filename as candidateName,
        es.role_id,
        r.title as roleName
      FROM evaluation_results er
      JOIN evaluation_files ef ON er.file_id = ef.id
      JOIN evaluation_sessions es ON er.evaluation_session_id = es.id
      JOIN roles r ON es.role_id = r.id
      WHERE ef.id = @candidateId
    `
    
    const queryParams: any = { candidateId: sql.UniqueIdentifier, candidateId }
    
    if (evaluationId) {
      candidateQuery += ` AND er.evaluation_session_id = @evaluationId`
      queryParams.evaluationId = sql.UniqueIdentifier
    }
    
    candidateQuery += ` ORDER BY er.created_at DESC`
    
    const candidateResult = await pool.request()
      .input('candidateId', sql.UniqueIdentifier, candidateId)
      .input('evaluationId', evaluationId ? sql.UniqueIdentifier : sql.Bit, evaluationId || null)
      .query(candidateQuery)
    
    if (candidateResult.recordset.length === 0) {
      return NextResponse.json(
        { error: 'Candidate evaluation not found' },
        { status: 404 }
      )
    }
    
    const candidate = candidateResult.recordset[0]
    
    // Fetch peer candidates for comparison
    const peersQuery = `
      SELECT er.final_score, er.confidence_level, er.base_score, er.bonus_points, er.penalty_points
      FROM evaluation_results er
      WHERE er.evaluation_session_id = @evaluationSessionId
      AND er.file_id != @candidateId
    `
    
    const peersResult = await pool.request()
      .input('evaluationSessionId', sql.UniqueIdentifier, candidate.evaluation_session_id)
      .input('candidateId', sql.UniqueIdentifier, candidateId)
      .query(peersQuery)
    
    const peers = peersResult.recordset
    
    // Generate candidate intelligence
    const intelligence = await generateCandidateIntelligence(candidate, peers)
    
    return NextResponse.json({
      success: true,
      data: intelligence,
      metadata: {
        generatedAt: new Date().toISOString(),
        candidateId,
        evaluationId: candidate.evaluation_session_id,
        roleId: candidate.role_id
      }
    })
    
  } catch (error) {
    console.error('Candidate intelligence error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate candidate intelligence',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function generateCandidateIntelligence(
  candidate: any,
  peers: any[]
): Promise<CandidateIntelligence> {
  
  // Parse evidence data
  const evidence = parseEvidence(candidate.analysis_result || candidate.evidence)
  const redFlags = parseArray(candidate.red_flags)
  const recommendations = parseArray(candidate.recommendations)
  
  // Calculate peer comparison metrics
  const peerScores = peers.map(p => p.final_score).filter(s => s != null)
  const peerAverage = peerScores.length > 0 ? peerScores.reduce((a, b) => a + b, 0) / peerScores.length : 0
  const percentileRank = calculatePercentile(candidate.final_score || 0, peerScores)
  
  // Generate intelligence insights
  const intelligence: CandidateIntelligence = {
    candidate: {
      id: candidate.file_id,
      name: candidate.candidateName,
      overallScore: candidate.final_score || 0,
      confidenceLevel: candidate.confidence_level || 'MEDIUM',
      
      scoring: {
        baseScore: candidate.base_score || candidate.final_score || 0,
        bonusPoints: candidate.bonus_points || 0,
        penaltyPoints: candidate.penalty_points || 0,
        finalScore: candidate.final_score || 0
      },
      
      intelligence: {
        successPrediction: calculateSuccessPrediction(candidate),
        retentionProbability: calculateRetentionProbability(candidate, redFlags),
        performanceProjection: calculatePerformanceProjection(candidate),
        culturalFit: calculateCulturalFit(candidate, evidence),
        
        marketValue: {
          salaryRange: estimateSalaryRange(candidate),
          demandLevel: assessMarketDemand(candidate, evidence),
          competitiveRisk: assessCompetitiveRisk(candidate),
          negotiationLeverage: assessNegotiationLeverage(candidate)
        }
      },
      
      evidence: {
        strengths: extractStrengths(evidence, recommendations),
        concerns: extractConcerns(redFlags),
        differentiators: extractDifferentiators(evidence)
      },
      
      recommendations: {
        interviewFocus: generateInterviewFocus(candidate, evidence),
        assessmentStrategy: generateAssessmentStrategy(candidate),
        timelineUrgency: assessTimelineUrgency(candidate),
        negotiationStrategy: generateNegotiationStrategy(candidate),
        onboardingConsiderations: generateOnboardingConsiderations(candidate, evidence)
      }
    },
    
    comparison: {
      percentileRank,
      peerComparison: generatePeerComparison(candidate, peers),
      uniqueValue: generateUniqueValue(candidate, evidence),
      alternativeCandidates: [] // Would be populated with similar candidates
    },
    
    riskProfile: {
      flightRisk: assessFlightRisk(candidate, evidence),
      adaptabilityRisk: assessAdaptabilityRisk(candidate, evidence),
      teamFitRisk: assessTeamFitRisk(candidate, redFlags),
      overallRisk: assessOverallRisk(candidate, redFlags),
      mitigationStrategies: generateMitigationStrategies(candidate, redFlags)
    }
  }
  
  return intelligence
}

// Utility functions for candidate analysis
function parseEvidence(evidenceData: any): any {
  try {
    if (typeof evidenceData === 'string') {
      return JSON.parse(evidenceData)
    }
    return evidenceData || {}
  } catch {
    return {}
  }
}

function parseArray(data: any): any[] {
  try {
    if (typeof data === 'string') {
      return JSON.parse(data)
    }
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function calculatePercentile(score: number, peerScores: number[]): number {
  if (peerScores.length === 0) return 50
  
  const lowerCount = peerScores.filter(s => s < score).length
  return (lowerCount / peerScores.length) * 100
}

function calculateSuccessPrediction(candidate: any): number {
  const score = candidate.final_score || 0
  const confidence = candidate.confidence_level
  
  let prediction = Math.min(95, score)
  
  if (confidence === 'HIGH') prediction += 5
  else if (confidence === 'LOW') prediction -= 10
  
  return Math.max(10, prediction)
}

function calculateRetentionProbability(candidate: any, redFlags: any[]): number {
  let probability = 85 // Base retention probability
  
  const stabilityFlags = redFlags.filter(flag => 
    flag.category === 'stability' || flag.description?.toLowerCase().includes('job hopping')
  )
  
  probability -= stabilityFlags.length * 15
  
  const score = candidate.final_score || 0
  if (score > 85) probability += 10
  else if (score < 60) probability -= 15
  
  return Math.max(20, Math.min(95, probability))
}

function calculatePerformanceProjection(candidate: any): "EXCEED" | "MEET" | "BELOW" {
  const score = candidate.final_score || 0
  
  if (score >= 85) return "EXCEED"
  if (score >= 70) return "MEET"
  return "BELOW"
}

function calculateCulturalFit(candidate: any, evidence: any): number {
  // Simplified cultural fit calculation
  const score = candidate.final_score || 0
  const hasTeamExperience = evidence.experience?.progressionQuality > 7
  const hasCommunicationSkills = evidence.skills?.some((s: any) => 
    s.skillName?.toLowerCase().includes('communication') || 
    s.skillName?.toLowerCase().includes('leadership')
  )
  
  let culturalFit = Math.min(85, score * 0.8)
  
  if (hasTeamExperience) culturalFit += 10
  if (hasCommunicationSkills) culturalFit += 5
  
  return Math.max(20, Math.min(95, culturalFit))
}

function estimateSalaryRange(candidate: any): [number, number] {
  const score = candidate.final_score || 0
  const baseRange = [80000, 120000]
  const multiplier = Math.max(0.8, Math.min(2.0, score / 75))
  
  return [Math.round(baseRange[0] * multiplier), Math.round(baseRange[1] * multiplier)]
}

function assessMarketDemand(candidate: any, evidence: any): "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW" {
  const score = candidate.final_score || 0
  const hasHighDemandSkills = evidence.skills?.some((s: any) => {
    const skill = s.skillName?.toLowerCase() || ''
    return ['react', 'typescript', 'aws', 'kubernetes', 'python', 'ai', 'machine learning'].some(ds => skill.includes(ds))
  })
  
  if (score > 85 && hasHighDemandSkills) return "VERY_HIGH"
  if (score > 75 || hasHighDemandSkills) return "HIGH"
  if (score > 60) return "MEDIUM"
  return "LOW"
}

function assessCompetitiveRisk(candidate: any): number {
  const score = candidate.final_score || 0
  
  if (score >= 90) return 85 // Very high risk of being poached
  if (score >= 80) return 70
  if (score >= 70) return 50
  return 25
}

function assessNegotiationLeverage(candidate: any): "HIGH" | "MEDIUM" | "LOW" {
  const score = candidate.final_score || 0
  
  if (score >= 85) return "HIGH"
  if (score >= 70) return "MEDIUM"
  return "LOW"
}

function extractStrengths(evidence: any, recommendations: any[]): Array<{
  category: string
  description: string
  evidenceStrength: number
  businessImpact: string
}> {
  const strengths = []
  
  // Extract from skills evidence
  if (evidence.skills) {
    evidence.skills.forEach((skill: any) => {
      if (skill.confidence > 7) {
        strengths.push({
          category: "Technical Skills",
          description: `Strong expertise in ${skill.skillName}`,
          evidenceStrength: skill.confidence,
          businessImpact: "Immediate productivity contribution"
        })
      }
    })
  }
  
  // Extract from experience
  if (evidence.experience?.progressionQuality > 7) {
    strengths.push({
      category: "Career Progression",
      description: "Consistent career advancement and growth",
      evidenceStrength: evidence.experience.progressionQuality,
      businessImpact: "Leadership potential and adaptability"
    })
  }
  
  // Extract from recommendations
  recommendations.forEach((rec: any) => {
    if (rec.category === 'hire' && rec.priority === 'HIGH') {
      strengths.push({
        category: "Overall Assessment",
        description: rec.description,
        evidenceStrength: 9,
        businessImpact: "Strong hiring recommendation"
      })
    }
  })
  
  return strengths.slice(0, 5) // Top 5 strengths
}

function extractConcerns(redFlags: any[]): Array<{
  category: string
  description: string
  severity: "HIGH" | "MEDIUM" | "LOW"
  mitigation: string
}> {
  return redFlags.map(flag => ({
    category: flag.category || "General",
    description: flag.description || "Potential concern identified",
    severity: flag.severity || "MEDIUM",
    mitigation: generateMitigation(flag)
  }))
}

function extractDifferentiators(evidence: any): Array<{
  factor: string
  description: string
  marketRarity: number
}> {
  const differentiators = []
  
  // Check for rare skills
  if (evidence.skills) {
    evidence.skills.forEach((skill: any) => {
      const rareSkills = ['kubernetes', 'machine learning', 'blockchain', 'quantum computing']
      const skillName = skill.skillName?.toLowerCase() || ''
      
      if (rareSkills.some(rare => skillName.includes(rare))) {
        differentiators.push({
          factor: skill.skillName,
          description: `Expertise in emerging technology: ${skill.skillName}`,
          marketRarity: 85
        })
      }
    })
  }
  
  // Check for prestigious education
  if (evidence.education?.prestigeBonus > 5) {
    differentiators.push({
      factor: "Education",
      description: `Graduated from ${evidence.education.institution}`,
      marketRarity: 75
    })
  }
  
  return differentiators
}

function generateInterviewFocus(candidate: any, evidence: any): string[] {
  const focus = []
  
  const score = candidate.final_score || 0
  
  if (score < 70) {
    focus.push("Validate core technical skills through practical assessments")
  }
  
  if (evidence.experience?.stabilityScore < 7) {
    focus.push("Discuss career motivations and long-term goals")
  }
  
  focus.push("Assess cultural fit and team collaboration skills")
  focus.push("Validate problem-solving approach with scenario-based questions")
  
  return focus
}

function generateAssessmentStrategy(candidate: any): string {
  const score = candidate.final_score || 0
  
  if (score >= 85) {
    return "Streamlined technical assessment focused on leadership and strategic thinking"
  } else if (score >= 70) {
    return "Standard technical assessment with emphasis on skill validation"
  } else {
    return "Comprehensive assessment to identify development potential and skill gaps"
  }
}

function assessTimelineUrgency(candidate: any): "IMMEDIATE" | "FAST_TRACK" | "STANDARD" {
  const score = candidate.final_score || 0
  
  if (score >= 90) return "IMMEDIATE"
  if (score >= 80) return "FAST_TRACK"
  return "STANDARD"
}

function generateNegotiationStrategy(candidate: any): string {
  const score = candidate.final_score || 0
  
  if (score >= 85) {
    return "Competitive offer with emphasis on growth opportunities and company culture"
  } else if (score >= 70) {
    return "Market-rate offer highlighting learning and development opportunities"
  } else {
    return "Conservative offer with clear performance expectations and development plan"
  }
}

function generateOnboardingConsiderations(candidate: any, evidence: any): string[] {
  const considerations = []
  
  if (evidence.experience?.totalYears < 3) {
    considerations.push("Assign experienced mentor for first 90 days")
  }
  
  if (evidence.skills?.length < 5) {
    considerations.push("Create targeted skill development plan")
  }
  
  considerations.push("Regular check-ins during first 6 months")
  considerations.push("Integration with team culture and values")
  
  return considerations
}

function generatePeerComparison(candidate: any, peers: any[]): Array<{
  metric: string
  candidateValue: number
  peerAverage: number
  ranking: string
}> {
  if (peers.length === 0) return []
  
  const peerAvgScore = peers.reduce((sum, peer) => sum + (peer.final_score || 0), 0) / peers.length
  const peerAvgBonus = peers.reduce((sum, peer) => sum + (peer.bonus_points || 0), 0) / peers.length
  const peerAvgPenalty = peers.reduce((sum, peer) => sum + (peer.penalty_points || 0), 0) / peers.length
  
  return [
    {
      metric: "Overall Score",
      candidateValue: candidate.final_score || 0,
      peerAverage: peerAvgScore,
      ranking: (candidate.final_score || 0) > peerAvgScore ? "Above Average" : "Below Average"
    },
    {
      metric: "Bonus Points",
      candidateValue: candidate.bonus_points || 0,
      peerAverage: peerAvgBonus,
      ranking: (candidate.bonus_points || 0) > peerAvgBonus ? "Above Average" : "Below Average"
    },
    {
      metric: "Risk Factors",
      candidateValue: candidate.penalty_points || 0,
      peerAverage: peerAvgPenalty,
      ranking: (candidate.penalty_points || 0) < peerAvgPenalty ? "Lower Risk" : "Higher Risk"
    }
  ]
}

function generateUniqueValue(candidate: any, evidence: any): string {
  const score = candidate.final_score || 0
  
  if (score >= 90) {
    return "Exceptional candidate with rare combination of technical expertise and leadership potential"
  } else if (score >= 80) {
    return "Strong technical candidate with proven track record of delivery"
  } else if (score >= 70) {
    return "Solid candidate with good foundational skills and growth potential"
  } else {
    return "Developing candidate with specific areas of expertise"
  }
}

function assessFlightRisk(candidate: any, evidence: any): number {
  let risk = 30 // Base risk
  
  const score = candidate.final_score || 0
  if (score >= 85) risk += 20 // High performers are more likely to have options
  
  if (evidence.experience?.stabilityScore < 6) risk += 25
  
  return Math.min(85, risk)
}

function assessAdaptabilityRisk(candidate: any, evidence: any): number {
  let risk = 25 // Base risk
  
  if (evidence.experience?.totalYears > 10 && evidence.skills?.length < 8) {
    risk += 20 // Senior with limited modern skills
  }
  
  if (evidence.education?.relevanceScore < 6) risk += 15
  
  return Math.min(75, risk)
}

function assessTeamFitRisk(candidate: any, redFlags: any[]): number {
  let risk = 20 // Base risk
  
  const culturalFlags = redFlags.filter(flag => flag.category === 'cultural')
  risk += culturalFlags.length * 15
  
  const communicationFlags = redFlags.filter(flag => 
    flag.description?.toLowerCase().includes('communication') ||
    flag.description?.toLowerCase().includes('team')
  )
  risk += communicationFlags.length * 20
  
  return Math.min(80, risk)
}

function assessOverallRisk(candidate: any, redFlags: any[]): "LOW" | "MEDIUM" | "HIGH" {
  const highSeverityFlags = redFlags.filter(flag => flag.severity === 'HIGH').length
  const totalFlags = redFlags.length
  
  if (highSeverityFlags > 0 || totalFlags > 3) return "HIGH"
  if (totalFlags > 1) return "MEDIUM"
  return "LOW"
}

function generateMitigationStrategies(candidate: any, redFlags: any[]): string[] {
  const strategies = []
  
  redFlags.forEach(flag => {
    strategies.push(generateMitigation(flag))
  })
  
  // Add general strategies
  strategies.push("Structured 30-60-90 day plan with clear milestones")
  strategies.push("Regular feedback sessions and performance check-ins")
  
  return [...new Set(strategies)] // Remove duplicates
}

function generateMitigation(flag: any): string {
  const category = flag.category?.toLowerCase() || ''
  const description = flag.description?.toLowerCase() || ''
  
  if (category === 'stability' || description.includes('job hopping')) {
    return "Discuss career goals and provide clear growth path"
  }
  
  if (category === 'skills' || description.includes('skill')) {
    return "Create targeted training plan and assign technical mentor"
  }
  
  if (category === 'cultural' || description.includes('team')) {
    return "Team integration activities and cultural orientation program"
  }
  
  return "Monitor closely during probation period with regular feedback"
}