import { z } from "zod"

// Enhanced Requirements Schema with Optional Requirements Support (MOVED UP)
export const educationRequirementSchema = z.object({
  hasRequirements: z.boolean(),
  requirements: z.string().max(500, "Education requirements cannot exceed 500 characters")
}).refine((data) => {
  if (data.hasRequirements) {
    return data.requirements.trim().length >= 10
  }
  return true
}, {
  message: "Please provide education requirements (minimum 10 characters) or disable education requirements",
  path: ["requirements"]
})

export const experienceRequirementSchema = z.object({
  hasRequirements: z.boolean(),
  requirements: z.string().max(500, "Experience requirements cannot exceed 500 characters")
}).refine((data) => {
  if (data.hasRequirements) {
    return data.requirements.trim().length >= 10
  }
  return true
}, {
  message: "Please provide experience requirements (minimum 10 characters) or disable experience requirements",
  path: ["requirements"]
})

// Bonus configuration schemas with conditional validation
export const bonusConfigSchema = z.object({
  preferredEducation: z.object({
    enabled: z.boolean(),
    specificUniversities: z.array(z.string()).optional(),
    universityCategories: z.array(z.string()).optional()
  }).optional().refine((data) => {
    if (!data || !data.enabled) return true
    const hasUniversities = data.specificUniversities && data.specificUniversities.length > 0 && data.specificUniversities.some(u => u.trim() !== '')
    const hasCategories = data.universityCategories && data.universityCategories.length > 0
    return hasUniversities || hasCategories
  }, {
    message: "Please specify either universities or categories when education bonus is enabled"
  }),
  
  preferredCompanies: z.object({
    enabled: z.boolean(),
    specificCompanies: z.array(z.string()).optional(),
    companyCategories: z.array(z.string()).optional()
  }).optional().refine((data) => {
    if (!data || !data.enabled) return true
    const hasCompanies = data.specificCompanies && data.specificCompanies.length > 0 && data.specificCompanies.some(c => c.trim() !== '')
    const hasCategories = data.companyCategories && data.companyCategories.length > 0
    return hasCompanies || hasCategories
  }, {
    message: "Please specify either companies or categories when company bonus is enabled"
  }),
  
  relatedProjects: z.object({
    enabled: z.boolean(),
    description: z.string().max(1000, "Project description cannot exceed 1000 characters")
  }).optional().refine((data) => {
    if (!data || !data.enabled) return true
    return data.description && data.description.trim().length >= 10
  }, {
    message: "Please provide a project description (minimum 10 characters) when project bonus is enabled"
  }),
  
  relatedCertifications: z.object({
    enabled: z.boolean(),
    certificationsList: z.array(z.string())
  }).optional().refine((data) => {
    if (!data || !data.enabled) return true
    return data.certificationsList && data.certificationsList.length > 0 && data.certificationsList.some(c => c.trim() !== '')
  }, {
    message: "Please add at least one certification when certification bonus is enabled"
  })
}).optional()

// Penalty configuration schemas with conditional validation
export const penaltyConfigSchema = z.object({
  jobHopping: z.object({
    enabled: z.boolean(),
    sensitivity: z.enum(['strict', 'moderate', 'lenient'])
  }).optional().refine((data) => {
    if (!data || !data.enabled) return true
    return data.sensitivity && ['strict', 'moderate', 'lenient'].includes(data.sensitivity)
  }, {
    message: "Please select a sensitivity level when job stability check is enabled"
  }),
  
  employmentGaps: z.object({
    enabled: z.boolean(),
    threshold: z.enum(['6months', '1year', '2years'])
  }).optional().refine((data) => {
    if (!data || !data.enabled) return true
    return data.threshold && ['6months', '1year', '2years'].includes(data.threshold)
  }, {
    message: "Please select a threshold when employment gap check is enabled"
  })
}).optional()

// Base role validation schema (REMOVED unused fields: department, location, employment_type, seniority_level)
export const roleSchema = z.object({
  title: z.string()
    .min(2, "Title must be at least 2 characters")
    .max(120, "Title cannot exceed 120 characters"),
  
  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(2500, "Description cannot exceed 2500 characters"),
  
  responsibilities: z.string()
    .max(2500, "Responsibilities cannot exceed 2500 characters")
    .optional(),
  
  // REMOVED: department, location, employmentType, seniorityLevel, minExperienceYears, maxExperienceYears
  
  educationRequirements: educationRequirementSchema,
  experienceRequirements: experienceRequirementSchema,
    
  // NEW: Bonus and penalty configurations
  bonusConfig: bonusConfigSchema,
  penaltyConfig: penaltyConfigSchema
})

// Create role schema (for new roles) 
export const createRoleSchema = roleSchema.extend({
  title: z.string()
    .min(2, "Title is required and must be at least 2 characters")
    .max(120, "Title cannot exceed 120 characters"),
  description: z.string()
    .min(10, "Description is required and must be at least 10 characters")
    .max(2500, "Description cannot exceed 2500 characters"),
  educationRequirements: educationRequirementSchema,
  experienceRequirements: experienceRequirementSchema
})

// Update role schema (all fields optional except validation rules)
export const updateRoleSchema = roleSchema.partial()

// Skill validation schema
export const skillSchema = z.object({
  skillName: z.string()
    .min(1, "Skill name is required")
    .max(200, "Skill name cannot exceed 200 characters"),
  
  weight: z.number()
    .min(1, "Weight must be between 1 and 10")
    .max(10, "Weight must be between 1 and 10")
    .int("Weight must be a whole number"),
  
  isRequired: z.boolean().default(false),
  
  skillCategory: z.string()
    .max(50, "Category name cannot exceed 50 characters")
    .optional(),
  
  roleId: z.string().uuid("Invalid role ID")
})

// Create skill schema (for API calls)
export const createSkillSchema = skillSchema

// Bulk skills schema (for multiple skills at once)
export const bulkSkillsSchema = z.object({
  roleId: z.string().uuid("Invalid role ID"),
  skills: z.array(skillSchema.omit({ roleId: true }))
    .min(1, "At least one skill is required")
    .max(50, "Maximum 50 skills allowed per role")
})

// Question validation schema
export const questionSchema = z.object({
  questionText: z.string()
    .min(5, "Question must be at least 5 characters")
    .max(200, "Question cannot exceed 200 characters"),
  
  weight: z.number()
    .min(1, "Weight must be between 1 and 10")
    .max(10, "Weight must be between 1 and 10")
    .int("Weight must be a whole number"),
  
  category: z.string()
    .max(50, "Category name cannot exceed 50 characters")
    .optional(),
  
  roleId: z.string().uuid("Invalid role ID")
})

// Create question schema (for API calls)
export const createQuestionSchema = questionSchema

// Bulk questions schema (for multiple questions at once)
export const bulkQuestionsSchema = z.object({
  roleId: z.string().uuid("Invalid role ID"),
  questions: z.array(questionSchema.omit({ roleId: true }))
    .max(5, "Maximum 5 questions allowed per role")
})

// Complete role with skills and questions schema (for complex forms)
export const completeRoleSchema = z.object({
  role: createRoleSchema,
  skills: z.array(skillSchema.omit({ roleId: true }))
    .min(1, "At least one skill is required")
    .max(50, "Maximum 50 skills allowed per role"),
  questions: z.array(questionSchema.omit({ roleId: true }))
    .max(5, "Maximum 5 questions allowed per role")
    .optional()
})

// Form step validation schemas
export const jobDetailsStepSchema = z.object({
  title: z.string()
    .min(2, "Title is required and must be at least 2 characters")
    .max(120, "Title cannot exceed 120 characters"),
  
  description: z.string()
    .min(10, "Description is required and must be at least 10 characters")
    .max(2500, "Description cannot exceed 2500 characters"),
  
  responsibilities: z.string()
    .max(2500, "Responsibilities cannot exceed 2500 characters")
    .optional(),
})

// Requirements step schema (ENHANCED - flexible education/experience handling)
export const requirementsStepSchema = z.object({
  educationRequirements: educationRequirementSchema,
  experienceRequirements: experienceRequirementSchema
})

// Bonus/Penalty step schema (NEW)
export const bonusPenaltyStepSchema = z.object({
  bonusConfig: bonusConfigSchema,
  penaltyConfig: penaltyConfigSchema
})

// Skill schema for form steps (with enforced limits)
export const skillsStepSchema = z.object({
  skills: z.array(z.object({
    skillName: z.string()
      .max(200, "Skill name cannot exceed 200 characters")
      .optional()
      .or(z.literal("")), // Allow empty strings
    
    weight: z.number()
      .min(1, "Weight must be between 1 and 10")
      .max(10, "Weight must be between 1 and 10")
      .int("Weight must be a whole number"),
    
    isRequired: z.boolean().default(false).optional(),
    
    skillCategory: z.string()
      .max(50, "Category name cannot exceed 50 characters")
      .optional(),
  }))
  .max(10, "Maximum 10 skills allowed per role")
  .refine((skills) => {
    // Count required skills (filter out empty skills first)
    const validSkills = skills.filter(skill => skill.skillName && skill.skillName.trim() !== "")
    const requiredSkills = validSkills.filter(skill => skill.isRequired)
    return requiredSkills.length <= 5
  }, {
    message: "Maximum 5 required skills allowed per role",
    path: ["skills"]
  })
})
// Questions step schema (for form step validation)
export const questionsStepSchema = z.object({
  questions: z.array(z.object({
    questionText: z.string()
      .min(5, "Question must be at least 5 characters")
      .max(200, "Question cannot exceed 200 characters"),
    
    weight: z.number()
      .min(1, "Weight must be between 1 and 10")
      .max(10, "Weight must be between 1 and 10")
      .int("Weight must be a whole number"),
    
    category: z.string()
      .max(50, "Category name cannot exceed 50 characters")
      .optional(),
  }))
  .max(5, "Maximum 5 questions allowed per role")
  .optional()
})

// Predefined skill categories
export const skillCategories = [
  "Technical",
  "Programming",
  "Framework", 
  "Tool",
  "Language",
  "Soft Skill",
  "Leadership",
  "Communication",
  "Analytics",
  "Design",
  "Business",
  "Industry",
  "Certification",
  "Other"
] as const

// Predefined question categories
export const questionCategories = [
  "Technical",
  "Behavioral",
  "Experience",
  "Problem Solving",
  "Leadership",
  "Communication",
  "Culture Fit",
  "Goals",
  "Scenario",
  "Other"
] as const

// University categories for bonus configuration
export const universityCategories = [
  "Top League (Ivy League/Oxbridge)",
  "Top 50 Global Universities", 
  "Top 100 Global Universities",
  "Regional Top Universities"
] as const

// Company categories for bonus configuration
export const companyCategories = [
  "FAANG/Top Tech Companies",
  "Unicorns ($1B+ startups)",
  "Fortune 500",
  "Industry Leaders",
  "Direct Competitors"
] as const

// Job hopping sensitivity levels
export const jobHoppingSensitivity = [
  { value: "strict", label: "Strict (>20% short tenures)" },
  { value: "moderate", label: "Moderate (>30% short tenures)" },
  { value: "lenient", label: "Lenient (>50% short tenures)" }
] as const

// Employment gap thresholds
export const employmentGapThresholds = [
  { value: "6months", label: "6 months" },
  { value: "1year", label: "1 year" },
  { value: "2years", label: "2 years" }
] as const


// Type exports for TypeScript
export type Role = z.infer<typeof roleSchema>
export type CreateRole = z.infer<typeof createRoleSchema>
export type UpdateRole = z.infer<typeof updateRoleSchema>
export type JobDetailsStep = z.infer<typeof jobDetailsStepSchema>
export type RequirementsStep = z.infer<typeof requirementsStepSchema>
export type EducationRequirement = z.infer<typeof educationRequirementSchema>
export type ExperienceRequirement = z.infer<typeof experienceRequirementSchema>
export type BonusPenaltyStep = z.infer<typeof bonusPenaltyStepSchema>
export type BonusConfig = z.infer<typeof bonusConfigSchema>
export type PenaltyConfig = z.infer<typeof penaltyConfigSchema>
export type Skill = z.infer<typeof skillSchema>
export type CreateSkill = z.infer<typeof createSkillSchema>
export type Question = z.infer<typeof questionSchema>
export type CreateQuestion = z.infer<typeof createQuestionSchema>
export type CompleteRole = z.infer<typeof completeRoleSchema>
export type SkillCategory = typeof skillCategories[number]
export type QuestionCategory = typeof questionCategories[number]
export type UniversityCategory = typeof universityCategories[number]
export type CompanyCategory = typeof companyCategories[number]
export type JobHoppingSensitivity = typeof jobHoppingSensitivity[number]["value"]
export type EmploymentGapThreshold = typeof employmentGapThresholds[number]["value"]