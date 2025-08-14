# Dynamic Requirements & Skills System

## Dynamic Requirements Builder

### Requirements Categories with Individual Weights

#### Education Requirements
```
┌─────────────────────────────────────────────────┐
│ Education Requirements                          │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Master in Computer Science    Weight: [8/10]│ │
│ │ [×] Remove                                  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Bachelor's in Engineering     Weight: [6/10]│ │
│ │ [×] Remove                                  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [+ Add Education Requirement]                   │
└─────────────────────────────────────────────────┘
```

#### Experience Requirements
```
┌─────────────────────────────────────────────────┐
│ Experience Requirements                         │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 10 years experience in automotive industry   │ │
│ │ Weight: [●●●●●●●●●○] 9/10        [×] Remove │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 5+ years in management role                 │ │
│ │ Weight: [●●●●●●●○○○] 7/10        [×] Remove │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Experience with international teams         │ │
│ │ Weight: [●●●●○○○○○○] 4/10        [×] Remove │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [+ Add Experience Requirement]                  │
└─────────────────────────────────────────────────┘
```

#### Skills Requirements
```
┌─────────────────────────────────────────────────┐
│ Skills Requirements                             │
├─────────────────────────────────────────────────┤
│                                                 │
│ Technical Skills:                               │
│ ┌─────────────────────────────────────────────┐ │
│ │ Microsoft Office Suite      Weight: [6/10]  │ │
│ │ [×] Remove                                  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Project Management (PMP)     Weight: [8/10] │ │
│ │ [×] Remove                                  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Soft Skills:                                    │
│ ┌─────────────────────────────────────────────┐ │
│ │ Team Leadership              Weight: [9/10] │ │
│ │ [×] Remove                                  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Communication Skills         Weight: [7/10] │ │
│ │ [×] Remove                                  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [+ Add Technical Skill] [+ Add Soft Skill]      │
└─────────────────────────────────────────────────┘
```

## Dynamic Input Interface

### Add Requirement Modal
```
┌─────────────────────────────────────────────────┐
│ Add New Requirement                             │
├─────────────────────────────────────────────────┤
│                                                 │
│ Category: [Experience ▼]                        │
│                                                 │
│ Requirement Text:                               │
│ ┌─────────────────────────────────────────────┐ │
│ │ 3+ years experience in SaaS companies       │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Importance Weight: [●●●●●●●○○○] 7/10            │
│                                                 │
│ ☐ This is a must-have (auto-reject if missing) │
│                                                 │
│ [Cancel] [Add Requirement]                      │
└─────────────────────────────────────────────────┘
```

### Smart Suggestions System
```
As user types: "master in c..."

Suggestions dropdown:
┌─────────────────────────────────────┐
│ • Master in Computer Science        │
│ • Master in Computer Engineering    │
│ • Master in Civil Engineering       │
│ • Master in Chemistry              │
│ • Master's degree in any field     │
└─────────────────────────────────────┘
```

## Database Schema for Dynamic Requirements

### Requirements Table
```sql
role_requirements {
  id: UUID
  role_id: UUID
  category: ENUM('education', 'experience', 'technical_skill', 'soft_skill', 'certification', 'other')
  requirement_text: TEXT
  weight: INTEGER (1-10)
  is_must_have: BOOLEAN
  created_at: TIMESTAMP
}
```

### Smart Parsing for AI Analysis
```javascript
// Example requirement parsing
const requirements = [
  {
    text: "Master in Computer Science",
    category: "education", 
    weight: 8,
    keywords: ["master", "masters", "ms", "computer science", "CS"]
  },
  {
    text: "10 years experience in automotive industry",
    category: "experience",
    weight: 9, 
    keywords: ["10 years", "automotive", "car", "vehicle", "manufacturing"]
  },
  {
    text: "Microsoft Office proficiency",
    category: "technical_skill",
    weight: 6,
    keywords: ["microsoft office", "excel", "word", "powerpoint", "outlook"]
  }
]
```

## AI Matching Algorithm

### Scoring Logic
```javascript
function calculateRequirementScore(resume, requirements) {
  let totalScore = 0;
  let maxPossibleScore = 0;
  
  requirements.forEach(req => {
    maxPossibleScore += req.weight;
    
    // AI checks if requirement is met in resume
    const matchStrength = analyzeRequirementMatch(resume, req);
    totalScore += (matchStrength * req.weight);
    
    // Auto-reject if must-have requirement not met
    if (req.is_must_have && matchStrength < 0.7) {
      return { score: 0, decision: "REJECT", reason: `Missing required: ${req.text}` };
    }
  });
  
  return {
    score: (totalScore / maxPossibleScore) * 100,
    breakdown: requirementBreakdown
  };
}
```

## User Experience Examples

### Adding Diverse Requirements
1. **Education**: "PhD in Machine Learning" (Weight: 10)
2. **Experience**: "5+ years in fintech startups" (Weight: 8) 
3. **Skills**: "Fluent in Spanish and English" (Weight: 6)
4. **Certification**: "PMP certification preferred" (Weight: 4)
5. **Industry**: "Healthcare industry background" (Weight: 7)

### Flexibility Benefits
- **Industry-specific**: Automotive, healthcare, tech, finance
- **Role-specific**: Management, technical, sales, creative
- **Level-specific**: Entry, mid, senior, executive
- **Location-specific**: Remote work experience, specific regions
- **Cultural**: Team collaboration, startup environment

## Implementation Notes

### Requirement Categories
- **Education**: Degrees, certifications, institutions
- **Experience**: Years, industries, company types, roles
- **Technical Skills**: Software, tools, programming languages
- **Soft Skills**: Leadership, communication, problem-solving
- **Certifications**: Professional licenses, industry certifications
- **Other**: Location, language, availability, etc.

### AI Parsing Intelligence
- Understand synonyms and variations
- Context-aware matching (e.g., "React" as JavaScript library vs chemical reaction)
- Fuzzy matching for similar skills
- Industry-specific keyword recognition