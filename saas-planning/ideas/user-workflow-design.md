# User Workflow Design - Role-Based Evaluation System

## Core User Journey

### Phase 1: Role Creation Section
```
Create New Role
├── Job Title: "Senior React Developer"
├── Job Description (LinkedIn-style):
│   ├── About the Role (responsibilities)
│   ├── Requirements (education, experience)
│   └── Key Responsibilities (bullet points)
├── Skills Assessment:
│   ├── Must-Have Skills (weight: 10, auto-reject if missing)
│   ├── Important Skills (weight: 7-9)
│   └── Nice-to-Have Skills (weight: 1-6)
├── Custom Questions:
│   ├── Question text + weight (1-10)
│   ├── AI validation ✓
│   └── Category selection
└── Save Role → Available for future use
```

### Phase 2: Evaluation Section
```
Start New Evaluation
├── Select Role: [Dropdown of saved roles]
├── Upload Files: [Drag & drop up to 100 PDFs]
├── Review Settings: [Preview role requirements]
└── Press "EVALUATE" → Processing begins
```

## Role Creation Interface Design

### Job Information Input
```
┌─────────────────────────────────────────────────┐
│ Create New Role                                 │
├─────────────────────────────────────────────────┤
│ Job Title: [Senior React Developer          ]  │
│                                                 │
│ Job Description:                                │
│ ┌─────────────────────────────────────────────┐ │
│ │ We are seeking a Senior React Developer to │ │
│ │ join our growing team. You will be         │ │
│ │ responsible for building scalable web      │ │
│ │ applications and mentoring junior devs...  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Key Responsibilities:                           │
│ • Develop and maintain React applications      │
│ • Collaborate with design and backend teams    │
│ • Code review and mentoring                    │
│ • Performance optimization                     │
└─────────────────────────────────────────────────┘
```

### Skills Matrix Interface
```
┌─────────────────────────────────────────────────┐
│ Skills Assessment                               │
├─────────────────────────────────────────────────┤
│                                                 │
│ Must-Have Skills (Auto-reject if missing):     │
│ ┌─────────────────┬─────────┬─────────────────┐ │
│ │ React           │ [●●●●●●●●●●] │ Weight: 10  │ │
│ │ JavaScript      │ [●●●●●●●●●●] │ Weight: 10  │ │
│ │ 3+ years exp    │ [●●●●●●●●●●] │ Weight: 10  │ │
│ └─────────────────┴─────────┴─────────────────┘ │
│                                                 │
│ Important Skills:                               │
│ ┌─────────────────┬─────────┬─────────────────┐ │
│ │ TypeScript      │ [●●●●●●●●○○] │ Weight: 8   │ │
│ │ Node.js         │ [●●●●●●●○○○] │ Weight: 7   │ │
│ │ Testing (Jest)  │ [●●●●●●○○○○] │ Weight: 6   │ │
│ └─────────────────┴─────────┴─────────────────┘ │
│                                                 │
│ Nice-to-Have Skills:                            │
│ ┌─────────────────┬─────────┬─────────────────┐ │
│ │ GraphQL         │ [●●●●○○○○○○] │ Weight: 4   │ │
│ │ Docker          │ [●●●○○○○○○○] │ Weight: 3   │ │
│ └─────────────────┴─────────┴─────────────────┘ │
│                                                 │
│ [+ Add Skill] [Save Role] [Preview]             │
└─────────────────────────────────────────────────┘
```

### Custom Questions Section
```
┌─────────────────────────────────────────────────┐
│ Custom Questions                                │
├─────────────────────────────────────────────────┤
│                                                 │
│ Question 1:                                     │
│ ┌─────────────────────────────────────────────┐ │
│ │ Describe your experience with state         │ │
│ │ management in large React applications      │ │
│ └─────────────────────────────────────────────┘ │
│ Weight: [●●●●●●●●○○] 8/10  Category: [Technical▼]│
│ ✓ AI Validated                                  │
│                                                 │
│ Question 2:                                     │
│ ┌─────────────────────────────────────────────┐ │
│ │ How do you approach mentoring junior        │ │
│ │ developers?                                 │ │
│ └─────────────────────────────────────────────┘ │
│ Weight: [●●●●●●○○○○] 6/10  Category: [Leadership▼]│
│ ✓ AI Validated                                  │
│                                                 │
│ [+ Add Question] [Save Role]                    │
└─────────────────────────────────────────────────┘
```

## Evaluation Section Interface

### Role Selection & File Upload
```
┌─────────────────────────────────────────────────┐
│ Start New Evaluation                            │
├─────────────────────────────────────────────────┤
│                                                 │
│ Select Role:                                    │
│ ┌─────────────────────────────────────────────┐ │
│ │ Senior React Developer               [▼]   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Upload Resumes:                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │        📁 Drag & drop PDF files here       │ │
│ │           or click to browse                │ │
│ │                                             │ │
│ │         Uploaded: 47/100 files              │ │
│ │         Total size: 12.3 MB                 │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [Preview Role Settings] [EVALUATE] ←Big Button  │
└─────────────────────────────────────────────────┘
```

## Database Schema (Simplified)

### Roles Table
```sql
roles {
  id: UUID
  user_id: UUID  
  title: VARCHAR
  description: TEXT
  responsibilities: JSON
  created_at: TIMESTAMP
}
```

### Skills Table
```sql
role_skills {
  id: UUID
  role_id: UUID
  skill_name: VARCHAR
  weight: INTEGER (1-10)
  is_required: BOOLEAN
}
```

### Questions Table
```sql
role_questions {
  id: UUID
  role_id: UUID
  question_text: TEXT
  weight: INTEGER (1-10)
  category: VARCHAR
}
```

## Key Benefits of This Approach

1. **Reusability**: Create role once, use for multiple evaluations
2. **Consistency**: Same evaluation criteria across hiring cycles
3. **Flexibility**: Easy to modify roles for different positions
4. **Efficiency**: No need to re-enter job details each time
5. **Comparison**: Compare candidates across different evaluation sessions