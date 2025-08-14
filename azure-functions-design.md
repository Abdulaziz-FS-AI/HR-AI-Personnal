# Azure Functions Processing Pipeline

## Function App Structure
```
hr-ai-saas-functions/
├── auth-functions/
│   ├── login/
│   ├── register/
│   └── refresh-token/
├── role-management/
│   ├── create-role/
│   ├── get-roles/
│   ├── update-role/
│   └── delete-role/
├── evaluation-functions/
│   ├── create-evaluation/
│   ├── get-evaluations/
│   └── get-evaluation-results/
├── file-processing/
│   ├── upload-handler/
│   ├── pdf-processor/
│   ├── ai-analyzer/
│   └── results-compiler/
├── queue-functions/
│   ├── queue-processor/
│   └── retry-handler/
├── export-functions/
│   ├── export-csv/
│   └── export-pdf/
└── shared/
    ├── db-utils.ts
    ├── blob-utils.ts
    ├── ai-utils.ts
    └── validation.ts
```

## Core Processing Pipeline

### 1. Upload Handler Function
```typescript
// Triggered by HTTP POST with multipart/form-data
export async function uploadHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  
  // 1. Validate user authentication
  const user = await validateToken(request);
  
  // 2. Validate evaluation exists and belongs to user
  const evaluationId = request.params.evaluationId;
  const evaluation = await getEvaluation(evaluationId, user.id);
  
  // 3. Process uploaded files
  const files = await parseMultipartForm(request);
  const uploadPromises = files.map(async (file) => {
    
    // Validate file (PDF, <10MB)
    validatePdfFile(file);
    
    // Upload to Azure Blob Storage
    const blobUrl = await uploadToBlob(file, evaluationId);
    
    // Create resume record in database
    const resume = await createResumeRecord({
      evaluationId,
      originalFilename: file.name,
      fileSizeBytes: file.size,
      fileUrl: blobUrl,
      status: 'uploaded'
    });
    
    // Add to processing queue
    await addToProcessingQueue(resume.id, {
      priority: 5,
      retryCount: 0
    });
    
    return resume;
  });
  
  const resumes = await Promise.all(uploadPromises);
  
  // Update evaluation with file count
  await updateEvaluation(evaluationId, {
    totalResumes: resumes.length,
    status: 'processing'
  });
  
  return {
    status: 200,
    jsonBody: {
      success: true,
      uploadedFiles: resumes.length,
      evaluationId
    }
  };
}
```

### 2. Queue Processor Function
```typescript
// Triggered by Service Bus Queue messages
export async function queueProcessor(
  message: ServiceBusReceivedMessage,
  context: InvocationContext
): Promise<void> {
  
  try {
    const { resumeId } = JSON.parse(message.body);
    
    // Mark as processing
    await updateResumeStatus(resumeId, 'processing');
    await updateQueueItem(message.messageId, {
      status: 'processing',
      startedAt: new Date(),
      assignedWorker: context.functionName
    });
    
    // Process the resume
    await processResume(resumeId);
    
    // Mark as completed
    await updateQueueItem(message.messageId, {
      status: 'completed',
      completedAt: new Date()
    });
    
  } catch (error) {
    context.error('Processing failed:', error);
    
    // Handle retry logic
    await handleProcessingError(message, error);
  }
}

async function processResume(resumeId: string) {
  // 1. Extract text from PDF
  const resume = await getResume(resumeId);
  const extractedText = await extractTextFromPdf(resume.fileUrl);
  
  // 2. Update resume with extracted text
  await updateResume(resumeId, {
    extractedText,
    status: 'analyzing'
  });
  
  // 3. Get role requirements for analysis
  const evaluation = await getEvaluationWithRole(resume.evaluationId);
  const role = evaluation.role;
  
  // 4. Analyze with AI
  const analysis = await analyzeResumeWithAI(extractedText, role);
  
  // 5. Save analysis results
  await saveAnalysisResults(resumeId, analysis);
  
  // 6. Update resume status
  await updateResume(resumeId, { status: 'analyzed' });
  
  // 7. Check if evaluation is complete
  await checkEvaluationCompletion(resume.evaluationId);
}
```

### 3. AI Analyzer Function
```typescript
async function analyzeResumeWithAI(
  resumeText: string,
  role: Role
): Promise<ResumeAnalysis> {
  
  // Build AI prompt based on role requirements
  const prompt = buildAnalysisPrompt(resumeText, role);
  
  // Call Llama 3.1 API
  const response = await callLlamaAPI({
    model: "meta-llama/Llama-3.1-70b-chat-hf",
    messages: [
      {
        role: "system",
        content: "You are an expert HR professional analyzing resumes..."
      },
      {
        role: "user", 
        content: prompt
      }
    ],
    temperature: 0.1,
    max_tokens: 2000
  });
  
  // Parse structured response
  const analysis = parseAIResponse(response.choices[0].message.content);
  
  return {
    overallScore: analysis.overall_score,
    technicalScore: analysis.technical_score,
    experienceScore: analysis.experience_score,
    educationScore: analysis.education_score,
    skillsScore: analysis.skills_score,
    cultureFitScore: analysis.culture_fit_score,
    executiveSummary: analysis.executive_summary,
    detailedAnalysis: analysis.detailed_analysis,
    topStrengths: analysis.top_strengths,
    concernsGaps: analysis.concerns_gaps,
    redFlags: analysis.red_flags,
    standoutAchievements: analysis.standout_achievements,
    interviewQuestions: analysis.interview_questions,
    recommendation: analysis.recommendation,
    recommendationReason: analysis.recommendation_reason,
    matchedSkills: analysis.matched_skills,
    missingRequiredSkills: analysis.missing_required_skills,
    aiModelUsed: "meta-llama/Llama-3.1-70b-chat-hf",
    processingTimeSeconds: Math.floor(Date.now() / 1000),
    aiCost: calculateAICost(response.usage)
  };
}

function buildAnalysisPrompt(resumeText: string, role: Role): string {
  return `
ROLE ANALYSIS REQUEST

JOB ROLE: ${role.title}
DEPARTMENT: ${role.department}
DESCRIPTION: ${role.description}

REQUIRED SKILLS (Must-have, Weight 10):
${role.skills.filter(s => s.isRequired).map(s => `- ${s.skillName}`).join('\n')}

IMPORTANT SKILLS (Weight 7-9):
${role.skills.filter(s => s.weight >= 7 && !s.isRequired).map(s => `- ${s.skillName} (Weight: ${s.weight})`).join('\n')}

NICE-TO-HAVE SKILLS (Weight 1-6):
${role.skills.filter(s => s.weight < 7).map(s => `- ${s.skillName} (Weight: ${s.weight})`).join('\n')}

CUSTOM QUESTIONS TO EVALUATE:
${role.questions.map(q => `- ${q.questionText} (Weight: ${q.weight})`).join('\n')}

RESUME TO ANALYZE:
${resumeText}

ANALYSIS REQUIREMENTS:
Please provide a comprehensive analysis in the following JSON format:
{
  "overall_score": 0-100,
  "technical_score": 0-100,
  "experience_score": 0-100, 
  "education_score": 0-100,
  "skills_score": 0-100,
  "culture_fit_score": 0-100,
  "executive_summary": "2-3 sentence summary",
  "detailed_analysis": "paragraph analysis",
  "top_strengths": ["strength1", "strength2", "strength3"],
  "concerns_gaps": ["concern1", "concern2", "concern3"],
  "red_flags": ["flag1", "flag2"] or [],
  "standout_achievements": ["achievement1", "achievement2"],
  "interview_questions": ["question1", "question2", "question3"],
  "recommendation": "accept|maybe|reject",
  "recommendation_reason": "explanation",
  "matched_skills": {"skill": "evidence from resume"},
  "missing_required_skills": ["missing skill1", "missing skill2"]
}
`;
}
```

### 4. Results Compiler Function
```typescript
export async function compileResults(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  
  const evaluationId = request.params.evaluationId;
  const user = await validateToken(request);
  
  // Get all analyzed resumes for this evaluation
  const results = await getEvaluationResults(evaluationId, user.id);
  
  // Sort by overall score (descending)
  const sortedResults = results.sort((a, b) => 
    b.analysis.overallScore - a.analysis.overallScore
  );
  
  // Calculate statistics
  const stats = calculateEvaluationStats(results);
  
  return {
    status: 200,
    jsonBody: {
      evaluationId,
      totalCandidates: results.length,
      processedCandidates: results.filter(r => r.status === 'analyzed').length,
      statistics: stats,
      candidates: sortedResults.map(formatCandidateResult)
    }
  };
}

function calculateEvaluationStats(results: any[]) {
  const scores = results.map(r => r.analysis.overallScore);
  
  return {
    averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    medianScore: scores.sort()[Math.floor(scores.length / 2)],
    topScore: Math.max(...scores),
    acceptRecommendations: results.filter(r => 
      r.analysis.recommendation === 'accept'
    ).length,
    maybeRecommendations: results.filter(r => 
      r.analysis.recommendation === 'maybe'
    ).length,
    rejectRecommendations: results.filter(r => 
      r.analysis.recommendation === 'reject'
    ).length
  };
}
```

## Function Configuration

### 1. host.json
```json
{
  "version": "2.0",
  "functionTimeout": "00:10:00",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true
      }
    }
  },
  "extensions": {
    "http": {
      "routePrefix": "api",
      "maxConcurrentRequests": 100,
      "maxOutstandingRequests": 200
    },
    "serviceBus": {
      "prefetchCount": 32,
      "messageHandlerOptions": {
        "autoComplete": false,
        "maxConcurrentCalls": 16,
        "maxAutoRenewDuration": "00:05:00"
      }
    }
  }
}
```

### 2. Environment Variables
```
AZURE_SQL_CONNECTION_STRING=Server=hr-ai-saas-server.database.windows.net;Database=hr-ai-saas-db;Authentication=Active Directory Default;
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=hraisaas1754119004;...
LLAMA_API_KEY=your_llama_api_key
LLAMA_API_URL=https://api.together.xyz/v1/chat/completions
JWT_SECRET=your_jwt_secret
SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://...
```

## Error Handling & Retry Logic

### Retry Strategy
- **PDF Processing Failures**: Retry up to 3 times
- **AI API Timeouts**: Retry with exponential backoff
- **Database Connection Issues**: Retry immediately, then after 5s, 15s
- **Storage Upload Failures**: Retry up to 2 times

### Dead Letter Queue
- Failed messages after all retries go to dead letter queue
- Manual intervention required for dead letter processing
- Email notifications for critical failures

## Performance Optimization

### Concurrency
- Process up to 16 resumes simultaneously
- Use Azure Service Bus for reliable queuing
- Implement circuit breaker for AI API calls

### Cost Optimization
- Cache frequently used role data
- Batch AI API calls when possible
- Use cheapest storage tiers for completed analyses
- Implement smart retry logic to avoid unnecessary costs