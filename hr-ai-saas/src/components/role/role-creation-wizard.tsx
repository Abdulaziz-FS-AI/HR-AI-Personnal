"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, AlertCircle, Save } from "lucide-react"
import { JobDetailsForm } from "./job-details-form"
import { RequirementsMatrix, type Requirement } from "./requirements-matrix"
import { SkillsMatrix } from "./skills-matrix"
import { QuestionsBuilder } from "./questions-builder"
import { type JobDetailsStep, type Skill, type Question } from "@/lib/validations/role"

interface RoleData {
  job: JobDetailsStep | null
  requirements: Requirement[]
  skills: Skill[]
  questions: Question[]
}

interface RoleCreationWizardProps {
  initialData?: Partial<RoleData>
  isEditing?: boolean
  roleId?: string
}

const STEPS = [
  { id: 1, title: "Job Details", description: "Basic role information" },
  { id: 2, title: "Requirements", description: "Education, experience & qualifications" },
  { id: 3, title: "Skills Matrix", description: "Define required skills" },
  { id: 4, title: "Custom Questions", description: "Role-specific questions" },
  { id: 5, title: "Review & Create", description: "Finalize your role" }
]

export function RoleCreationWizard({ 
  initialData, 
  isEditing = false, 
  roleId 
}: RoleCreationWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  
  const [roleData, setRoleData] = useState<RoleData>({
    job: initialData?.job || null,
    requirements: initialData?.requirements || [],
    skills: initialData?.skills || [],
    questions: initialData?.questions || []
  })

  // Auto-save draft functionality
  useEffect(() => {
    const autoSave = () => {
      if (roleData.job || roleData.requirements.length > 0 || roleData.skills.length > 0 || roleData.questions.length > 0) {
        saveDraft()
      }
    }

    const interval = setInterval(autoSave, 30000) // Auto-save every 30 seconds
    return () => clearInterval(interval)
  }, [roleData])

  const handleJobDetailsSubmit = (jobData: JobDetailsStep) => {
    setRoleData(prev => ({ ...prev, job: jobData }))
  }

  const handleRequirementsSubmit = (requirements: Requirement[]) => {
    setRoleData(prev => ({ ...prev, requirements }))
  }

  const handleSkillsSubmit = (skills: Skill[]) => {
    setRoleData(prev => ({ ...prev, skills }))
  }

  const handleQuestionsSubmit = (questions: Question[]) => {
    setRoleData(prev => ({ ...prev, questions }))
  }

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const saveDraft = async () => {
    if (!roleData.job) return

    setIsSavingDraft(true)
    try {
      // In a real implementation, you'd save to localStorage or a draft API
      localStorage.setItem('roleDraft', JSON.stringify(roleData))
      toast.success("Draft saved automatically")
    } catch (error) {
      console.error('Error saving draft:', error)
    } finally {
      setIsSavingDraft(false)
    }
  }

  const createRole = async () => {
    if (!roleData.job) {
      toast.error("Please complete job details to create the role")
      return
    }
    
    // Show warnings for empty sections but don't block creation
    if (roleData.requirements.length === 0) {
      toast.warning("Role created without requirements - you can add them later")
    }
    if (roleData.skills.length === 0) {
      toast.warning("Role created without skills - you can add them later")
    }

    setIsLoading(true)
    try {
      // 1. Create the role - send only the job details we have
      const fullRoleData = roleData.job
      
      console.log('Creating role with data:', fullRoleData)
      
      const roleResponse = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fullRoleData),
      })

      console.log('Role creation response status:', roleResponse.status)

      if (!roleResponse.ok) {
        const errorData = await roleResponse.json()
        console.error('Role creation error:', errorData)
        throw new Error(errorData.message || 'Failed to create role')
      }

      const { data: createdRole } = await roleResponse.json()

      // 2. Add requirements
      if (roleData.requirements.length > 0) {
        const requirementPromises = roleData.requirements.map(requirement =>
          fetch('/api/role-requirements', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...requirement,
              roleId: createdRole.id
            }),
          })
        )

        await Promise.all(requirementPromises)
      }

      // 3. Add skills
      if (roleData.skills.length > 0) {
        const skillPromises = roleData.skills.map(async (skill) => {
          const response = await fetch('/api/role-skills', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...skill,
              roleId: createdRole.id
            }),
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            console.error('Skill creation error:', errorData)
            throw new Error(`Failed to create skill: ${errorData.message}`)
          }
          
          return response
        })

        await Promise.all(skillPromises)
      }

      // 4. Add questions (if any)
      if (roleData.questions.length > 0) {
        const questionPromises = roleData.questions.map(async question => {
          const response = await fetch('/api/role-questions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...question,
              roleId: createdRole.id
            }),
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            console.error('Question creation error:', errorData)
            throw new Error(`Failed to create question: ${errorData.message}`)
          }
          
          return response
        })

        await Promise.all(questionPromises)
      }

      // Clear the draft
      localStorage.removeItem('roleDraft')
      
      toast.success("Role created successfully!")
      router.push('/dashboard/roles')

    } catch (error) {
      console.error('Error creating role:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create role')
    } finally {
      setIsLoading(false)
    }
  }

  const updateRole = async () => {
    if (!roleId || !roleData.job) return

    setIsLoading(true)
    try {
      // Update role details
      const roleResponse = await fetch(`/api/roles/${roleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(roleData.job),
      })

      if (!roleResponse.ok) {
        throw new Error('Failed to update role')
      }

      // Note: For skills and questions updates, you'd need additional logic
      // to handle additions, deletions, and updates
      
      toast.success("Role updated successfully!")
      router.push('/dashboard/roles')

    } catch (error) {
      console.error('Error updating role:', error)
      toast.error('Failed to update role')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFinalSubmit = () => {
    if (isEditing && roleId) {
      updateRole()
    } else {
      createRole()
    }
  }

  const getStepStatus = (stepId: number) => {
    if (stepId < currentStep) return "completed"
    if (stepId === currentStep) return "current"
    return "upcoming"
  }

  const getProgress = () => {
    return ((currentStep - 1) / (STEPS.length - 1)) * 100
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <JobDetailsForm
            initialData={roleData.job || undefined}
            onSubmit={handleJobDetailsSubmit}
            onNext={nextStep}
            isLoading={isLoading}
          />
        )
      case 2:
        return (
          <RequirementsMatrix
            initialRequirements={roleData.requirements}
            onSubmit={handleRequirementsSubmit}
            onNext={nextStep}
            onPrevious={previousStep}
            isLoading={isLoading}
          />
        )
      case 3:
        return (
          <SkillsMatrix
            initialSkills={roleData.skills}
            onSubmit={handleSkillsSubmit}
            onNext={nextStep}
            onPrevious={previousStep}
            isLoading={isLoading}
          />
        )
      case 4:
        return (
          <QuestionsBuilder
            initialQuestions={roleData.questions}
            onSubmit={handleQuestionsSubmit}
            onNext={nextStep}
            onPrevious={previousStep}
            isLoading={isLoading}
          />
        )
      case 5:
        return (
          <ReviewStep
            roleData={roleData}
            onSubmit={handleFinalSubmit}
            onPrevious={previousStep}
            isLoading={isLoading}
            isEditing={isEditing}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {isEditing ? 'Edit Role' : 'Create New Role'}
          </h1>
          <p className="mt-2 text-gray-600">
            Define your perfect candidate requirements in 5 easy steps
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStep} of {STEPS.length}
            </span>
            <div className="flex items-center gap-2">
              {isSavingDraft && (
                <>
                  <Save className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-600">Saving draft...</span>
                </>
              )}
            </div>
          </div>
          <Progress value={getProgress()} className="h-2" />
        </div>

        {/* Steps Indicator */}
        <div className="mb-8">
          <nav aria-label="Progress">
            <ol role="list" className="flex items-center justify-between">
              {STEPS.map((step) => {
                const status = getStepStatus(step.id)
                return (
                  <li key={step.id} className="relative flex-1">
                    <div className="flex items-center">
                      <div className="relative flex items-center justify-center">
                        <div
                          className={`
                            flex h-8 w-8 items-center justify-center rounded-full border-2
                            ${status === 'completed' 
                              ? 'bg-blue-600 border-blue-600' 
                              : status === 'current'
                              ? 'border-blue-600 bg-white'
                              : 'border-gray-300 bg-white'
                            }
                          `}
                        >
                          {status === 'completed' ? (
                            <CheckCircle className="h-5 w-5 text-white" />
                          ) : (
                            <span
                              className={`
                                text-sm font-medium
                                ${status === 'current' ? 'text-blue-600' : 'text-gray-500'}
                              `}
                            >
                              {step.id}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 min-w-0 flex-1">
                        <p className={`text-sm font-medium ${status === 'current' ? 'text-blue-600' : 'text-gray-500'}`}>
                          {step.title}
                        </p>
                        <p className="text-xs text-gray-500">{step.description}</p>
                      </div>
                    </div>
                    {step.id < STEPS.length && (
                      <div
                        className={`
                          absolute top-4 left-8 -ml-px h-0.5 w-full
                          ${status === 'completed' ? 'bg-blue-600' : 'bg-gray-300'}
                        `}
                      />
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        </div>

        {/* Current Step Content */}
        <div className="mb-8">
          {renderCurrentStep()}
        </div>
      </div>
    </div>
  )
}

// Review Step Component
interface ReviewStepProps {
  roleData: RoleData
  onSubmit: () => void
  onPrevious: () => void
  isLoading: boolean
  isEditing: boolean
}

function ReviewStep({ roleData, onSubmit, onPrevious, isLoading, isEditing }: ReviewStepProps) {
  const { job, requirements, skills, questions } = roleData

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Review & {isEditing ? 'Update' : 'Create'} Role
        </CardTitle>
        <p className="text-center text-muted-foreground">
          Step 5 of 5: Review your role details before {isEditing ? 'updating' : 'creating'}
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Job Details Summary */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-3">Job Details</h3>
          {job ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Title:</strong> {job.title}</div>
              <div><strong>Department:</strong> {job.department || "Not specified"}</div>
              <div><strong>Location:</strong> {job.location || "Not specified"}</div>
              <div><strong>Employment Type:</strong> {job.employmentType || "Not specified"}</div>
              <div><strong>Seniority:</strong> {job.seniorityLevel || "Not specified"}</div>
              <div><strong>Experience:</strong> {job.minExperienceYears || 0}-{job.maxExperienceYears || "∞"} years</div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>Job details are required</span>
            </div>
          )}
        </div>

        {/* Requirements Summary */}
        <div className="bg-orange-50 p-4 rounded-lg">
          <h3 className="font-semibold text-orange-900 mb-3">Requirements ({requirements.length})</h3>
          {requirements.length > 0 ? (
            <div className="space-y-2">
              {requirements.map((requirement, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="flex-1">{requirement.requirementText}</span>
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-gray-500 capitalize">{requirement.category}</span>
                    <span className="font-medium">Weight: {requirement.weight}/10</span>
                    {requirement.isRequired && <span className="text-red-600 text-xs">Required</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-orange-700 text-sm">No requirements added (optional)</p>
          )}
        </div>

        {/* Skills Summary */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold text-green-900 mb-3">Skills ({skills.length})</h3>
          {skills.length > 0 ? (
            <div className="space-y-2">
              {skills.map((skill, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span>{skill.skillName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{skill.skillCategory}</span>
                    <span className="font-medium">Weight: {skill.weight}/10</span>
                    {skill.isRequired && <span className="text-red-600 text-xs">Required</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-green-700 text-sm">No skills added yet (you can add them later)</p>
          )}
        </div>

        {/* Questions Summary */}
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="font-semibold text-purple-900 mb-3">Custom Questions ({questions.length})</h3>
          {questions.length > 0 ? (
            <div className="space-y-2">
              {questions.map((question, index) => (
                <div key={index} className="text-sm">
                  <div className="flex justify-between items-start">
                    <span className="flex-1">{question.questionText}</span>
                    <div className="ml-4 text-right">
                      <span className="text-gray-500">{question.category}</span>
                      <div className="font-medium">Weight: {question.weight}/10</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-purple-700 text-sm">No custom questions added (optional)</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onPrevious}
            disabled={isLoading}
          >
            Previous Step
          </Button>
          
          <Button
            onClick={onSubmit}
            disabled={isLoading || !job}
            className="min-w-[160px]"
          >
            {isLoading 
              ? (isEditing ? "Updating..." : "Creating...") 
              : (isEditing ? "Update Role" : "Create Role")
            }
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}