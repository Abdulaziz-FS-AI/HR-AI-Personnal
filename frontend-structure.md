# Frontend Application Structure - Next.js 14

## Technology Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui
- **State Management**: Zustand
- **Authentication**: NextAuth.js with Azure SQL adapter
- **File Upload**: React Dropzone
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod validation

## Directory Structure
```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth group routes
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/              # Protected dashboard routes
│   │   ├── dashboard/
│   │   ├── roles/
│   │   │   ├── page.tsx          # Roles list
│   │   │   ├── create/
│   │   │   └── [id]/
│   │   ├── evaluations/
│   │   │   ├── page.tsx          # Evaluations list
│   │   │   ├── create/
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Evaluation details/results
│   │   │       └── results/
│   │   ├── analytics/
│   │   └── settings/
│   ├── api/                      # API routes (proxy to Azure Functions)
│   │   ├── auth/
│   │   ├── roles/
│   │   ├── evaluations/
│   │   └── upload/
│   ├── globals.css
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing page
├── components/
│   ├── ui/                       # Shadcn/ui components
│   ├── forms/
│   │   ├── role-creation-form.tsx
│   │   ├── skills-matrix.tsx
│   │   └── custom-questions.tsx
│   ├── upload/
│   │   ├── file-dropzone.tsx
│   │   └── upload-progress.tsx
│   ├── results/
│   │   ├── candidate-card.tsx
│   │   ├── results-table.tsx
│   │   ├── score-breakdown.tsx
│   │   └── export-options.tsx
│   ├── charts/
│   │   ├── score-distribution.tsx
│   │   └── analytics-dashboard.tsx
│   └── layout/
│       ├── sidebar.tsx
│       ├── header.tsx
│       └── breadcrumbs.tsx
├── lib/
│   ├── auth.ts                   # NextAuth configuration
│   ├── api.ts                    # API client functions
│   ├── db.ts                     # Database utilities
│   ├── upload.ts                 # File upload utilities
│   ├── validations.ts            # Zod schemas
│   └── utils.ts                  # General utilities
├── stores/
│   ├── auth-store.ts             # Authentication state
│   ├── role-store.ts             # Role creation state
│   ├── evaluation-store.ts       # Evaluation state
│   └── upload-store.ts           # File upload state
├── hooks/
│   ├── use-auth.ts
│   ├── use-roles.ts
│   ├── use-evaluations.ts
│   └── use-upload.ts
└── types/
    ├── auth.ts
    ├── role.ts
    ├── evaluation.ts
    └── api.ts
```

## Key Pages & Components

### 1. Role Creation Page (`/roles/create`)
```tsx
// Comprehensive role creation form with:
// - Job information input
// - Skills matrix with weight sliders
// - Custom questions builder
// - Real-time validation
// - Save & preview functionality
```

### 2. Evaluation Creation (`/evaluations/create`)
```tsx
// - Role selection dropdown
// - Drag & drop file upload (up to 100 PDFs)
// - File validation & preview
// - Processing initiation
// - Real-time progress tracking
```

### 3. Results Dashboard (`/evaluations/[id]/results`)
```tsx
// - Ranked candidate list with scores
// - Detailed score breakdowns
// - Filter & sorting options
// - Export functionality (CSV, PDF)
// - Individual candidate drill-down
```

### 4. Analytics Dashboard (`/analytics`)
```tsx
// - Hiring pipeline metrics
// - Score distribution charts
// - Time-to-hire analytics
// - ROI calculations
// - Usage statistics
```

## State Management with Zustand

### Role Store
```typescript
interface RoleStore {
  currentRole: Role | null
  roles: Role[]
  isCreating: boolean
  
  // Actions
  createRole: (role: CreateRoleInput) => Promise<void>
  updateRole: (id: string, updates: Partial<Role>) => Promise<void>
  deleteRole: (id: string) => Promise<void>
  fetchRoles: () => Promise<void>
  setCurrentRole: (role: Role) => void
}
```

### Evaluation Store
```typescript
interface EvaluationStore {
  currentEvaluation: Evaluation | null
  evaluations: Evaluation[]
  uploadProgress: UploadProgress
  results: CandidateResult[]
  
  // Actions
  createEvaluation: (input: CreateEvaluationInput) => Promise<void>
  uploadFiles: (files: File[]) => Promise<void>
  startProcessing: (evaluationId: string) => Promise<void>
  fetchResults: (evaluationId: string) => Promise<void>
}
```

## User Experience Flow

### 1. Onboarding Flow
```
Registration → Email Verification → Company Setup → 
First Role Creation → Tutorial → Credits Purchase
```

### 2. Role Creation Flow
```
Job Details → Skills Matrix → Custom Questions → 
Preview → Save → Success
```

### 3. Evaluation Flow
```
Select Role → Upload Files → Review Settings → 
Start Processing → Live Progress → View Results
```

### 4. Results Analysis Flow
```
Results Overview → Sort/Filter → Candidate Details → 
Export Options → Interview Prep
```

## Responsive Design Strategy
- **Mobile**: Basic viewing, limited editing
- **Tablet**: Full functionality with touch optimizations
- **Desktop**: Complete feature set with keyboard shortcuts

## Performance Optimizations
- **Code Splitting**: Route-based and component-based
- **Image Optimization**: Next.js Image component
- **Caching**: React Query for API data
- **Lazy Loading**: Components and images
- **Bundle Analysis**: Regular monitoring and optimization