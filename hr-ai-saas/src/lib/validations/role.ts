import { z } from "zod"

// Base role validation schema
export const roleSchema = z.object({
  title: z.string()
    .min(2, "Title must be at least 2 characters")
    .max(120, "Title cannot exceed 120 characters"),
  
  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(2500, "Description cannot exceed 2500 characters")
    .optional(),
  
  responsibilities: z.string()
    .max(2500, "Responsibilities cannot exceed 2500 characters")
    .optional(),
  
  department: z.string()
    .max(100, "Department name cannot exceed 100 characters")
    .optional(),
  
  location: z.string()
    .max(100, "Location cannot exceed 100 characters")
    .optional(),
  
  employmentType: z.enum([
    "full-time",
    "part-time", 
    "contract",
    "freelance",
    "internship"
  ], {
    errorMap: () => ({ message: "Please select a valid employment type" })
  }).optional(),
  
  seniorityLevel: z.enum([
    "entry",
    "junior",
    "mid",
    "senior",
    "lead",
    "executive"
  ], {
    errorMap: () => ({ message: "Please select a valid seniority level" })
  }).optional(),
  
  minExperienceYears: z.number()
    .min(0, "Experience cannot be negative")
    .max(50, "Experience cannot exceed 50 years")
    .optional(),
  
  maxExperienceYears: z.number()
    .min(0, "Experience cannot be negative")
    .max(50, "Experience cannot exceed 50 years")
    .optional(),
  
  educationRequirements: z.string()
    .max(500, "Education requirements cannot exceed 500 characters")
    .optional(),
}).refine((data) => {
  // Custom validation: min experience should not exceed max experience
  if (data.minExperienceYears && data.maxExperienceYears) {
    return data.minExperienceYears <= data.maxExperienceYears
  }
  return true
}, {
  message: "Minimum experience cannot exceed maximum experience",
  path: ["maxExperienceYears"]
})

// Create role schema (for new roles)
export const createRoleSchema = roleSchema.extend({
  title: z.string()
    .min(2, "Title is required and must be at least 2 characters")
    .max(120, "Title cannot exceed 120 characters")
})

// Update role schema (all fields optional except validation rules)
export const updateRoleSchema = roleSchema.partial()

// Skill validation schema
export const skillSchema = z.object({
  skillName: z.string()
    .min(1, "Skill name is required")
    .max(100, "Skill name cannot exceed 100 characters"),
  
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
    .min(10, "Description must be at least 10 characters")
    .max(2500, "Description cannot exceed 2500 characters")
    .optional(),
  
  responsibilities: z.string()
    .max(2500, "Responsibilities cannot exceed 2500 characters")
    .optional(),
  
  department: z.string()
    .max(100, "Department name cannot exceed 100 characters")
    .optional(),
  
  location: z.string()
    .max(100, "Location cannot exceed 100 characters")
    .optional(),
})

// Skill schema for form steps (with enforced limits)
export const skillsStepSchema = z.object({
  skills: z.array(z.object({
    skillName: z.string()
      .max(100, "Skill name cannot exceed 100 characters")
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

// Employment type options
export const employmentTypes = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "freelance", label: "Freelance" },
  { value: "internship", label: "Internship" }
] as const

// Seniority level options
export const seniorityLevels = [
  { value: "entry", label: "Entry Level" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid Level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
  { value: "executive", label: "Executive" }
] as const

// Type exports for TypeScript
export type Role = z.infer<typeof roleSchema>
export type CreateRole = z.infer<typeof createRoleSchema>
export type UpdateRole = z.infer<typeof updateRoleSchema>
export type JobDetailsStep = z.infer<typeof jobDetailsStepSchema>
export type Skill = z.infer<typeof skillSchema>
export type CreateSkill = z.infer<typeof createSkillSchema>
export type Question = z.infer<typeof questionSchema>
export type CreateQuestion = z.infer<typeof createQuestionSchema>
export type CompleteRole = z.infer<typeof completeRoleSchema>
export type SkillCategory = typeof skillCategories[number]
export type QuestionCategory = typeof questionCategories[number]
export type EmploymentType = typeof employmentTypes[number]["value"]
export type SeniorityLevel = typeof seniorityLevels[number]["value"]