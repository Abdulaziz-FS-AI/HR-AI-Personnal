# MVP Output Format - Resume Analysis Results

## Core AI Analysis Output (Per Resume)

### 1. Header Information
```json
{
  "candidate_info": {
    "name": "John Smith",
    "email": "john.smith@email.com", 
    "phone": "+1-555-0123",
    "location": "New York, NY"
  }
}
```

### 2. Overall Assessment
```json
{
  "overall_score": 87,           // 0-100 scale
  "decision": "ACCEPT",          // ACCEPT/MAYBE/REJECT
  "rank": 3,                     // Position in batch ranking
  "summary": "Strong technical background with 5+ years React experience. Excellent problem-solving skills demonstrated through open-source contributions. Minor gap in leadership experience but shows potential for growth."
}
```

### 3. Category Scoring
```json
{
  "skills_match": {
    "percentage": 85,
    "score": 8.5,
    "details": {
      "technical_skills": ["React: ✓", "Node.js: ✓", "Python: ✗", "AWS: ✓"],
      "soft_skills": ["Communication: ✓", "Leadership: ⚠", "Problem-solving: ✓"]
    }
  },
  "experience_relevance": {
    "percentage": 90,
    "score": 9.0,
    "years_experience": 5.5,
    "industry_match": true
  },
  "requirements_met": {
    "percentage": 80,
    "score": 8.0,
    "education": "✓ Bachelor's CS",
    "certifications": "⚠ AWS preferred but not required",
    "location": "✓ New York area"
  }
}
```

### 4. Custom Questions Analysis
```json
{
  "custom_questions": [
    {
      "question": "Describe experience with microservices architecture",
      "inferred_answer": "Candidate mentions building scalable APIs and distributed systems at TechCorp",
      "confidence": 0.8,
      "score": 7,
      "weight": 9
    },
    {
      "question": "Leadership experience managing teams",
      "inferred_answer": "No explicit team management mentioned, but led technical initiatives",
      "confidence": 0.6,
      "score": 4,
      "weight": 6
    }
  ]
}
```

### 5. Decision Justification
```json
{
  "justification": {
    "strengths": [
      "Strong technical skills matching 85% of requirements",
      "Proven experience in similar industry and company size",
      "Excellent problem-solving demonstrated through projects"
    ],
    "concerns": [
      "Limited leadership experience for senior role",
      "Missing Python skills (nice-to-have)"
    ],
    "recommendation": "Strong candidate for technical interview. Focus questions on leadership potential and Python willingness to learn."
  }
}
```

### 6. Next Steps & Feedback
```json
{
  "interview_suggestions": [
    "Ask about experience scaling applications under load",
    "Explore leadership scenarios and team collaboration style", 
    "Discuss learning approach for new technologies"
  ],
  "red_flags": [],
  "feedback_for_candidate": "Excellent technical background. Consider highlighting any team collaboration or mentoring experience more prominently."
}
```

## Batch Summary Output

### Top Candidates Dashboard
- **Rank 1-5**: Quick preview cards with key scores
- **Accept/Maybe/Reject counts**: Visual breakdown
- **Skills gap analysis**: What skills are missing across all candidates
- **Downloadable CSV**: All data in spreadsheet format

## File Processing Workflow Clarification

**What I meant by "file processing":**
- **Real-time**: User uploads → immediate analysis (good UX, higher costs)
- **Batch**: User uploads → queued → bulk processing (cost efficient, slight delay)

**For your SaaS**: Recommend **batch processing** with 5-15 minute completion time for 100 resumes.