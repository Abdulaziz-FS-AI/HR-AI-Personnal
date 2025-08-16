"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, AlertCircle, Save, ArrowLeft, ArrowRight } from "lucide-react"
import { JobDetailsForm } from "./steps/job-details-form"
import { RequirementsForm } from "./steps/requirements-form"
import { SkillsMatrix } from "./steps/skills-matrix"
import { BonusPenaltyConfig } from "./steps/bonus-penalty-config"
import { QuestionsBuilder } from "./steps/questions-builder"
import { type JobDetailsStep, type RequirementsStep, type BonusPenaltyStep, type Skill, type Question } from "@/lib/validations/role"

interface AdvancedRoleData {
  step1: JobDetailsStep | null
  step2: RequirementsStep | null
  step3: Skill[]
  step4: BonusPenaltyStep | null
  step5: Question[]
}

interface AdvancedRoleCreationWizardProps {
  initialData?: Partial<AdvancedRoleData>
  isEditing?: boolean
  roleId?: string
}

const STEPS = [
  { id: 1, title: "Job Details", description: "Title, description, responsibilities" },
  { id: 2, title: "Requirements", description: "Education & experience requirements" },
  { id: 3, title: "Skills Matrix", description: "Define required skills (Optional)" },
  { id: 4, title: "Bonus/Penalty Config", description: "Quality bonuses & risk factors (Optional)" },
  { id: 5, title: "Questions", description: "Custom evaluation questions (Optional)" }
]

export function AdvancedRoleCreationWizard({ 
  initialData, 
  isEditing = false, 
  roleId 
}: AdvancedRoleCreationWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  
  const [roleData, setRoleData] = useState<AdvancedRoleData>({
    step1: initialData?.step1 || null,
    step2: initialData?.step2 || null,
    step3: initialData?.step3 || [],
    step4: initialData?.step4 || null,
    step5: initialData?.step5 || []
  })

  // Auto-save draft functionality with debounce
  useEffect(() => {
    const hasData = roleData.step1 || roleData.step2 || roleData.step3.length > 0 || roleData.step4 || roleData.step5.length > 0
    if (!hasData) return
    
    const timeoutId = setTimeout(() => {
      saveDraft()
    }, 2000) // Auto-save 2 seconds after data changes

    return () => clearTimeout(timeoutId)
  }, [roleData])

  const updateStepData = (step: keyof AdvancedRoleData, data: any) => {
    setRoleData(prev => ({ ...prev, [step]: data }))
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

  const skipStep = () => {
    nextStep()
  }

  const saveDraft = async () => {
    if (!roleData.step1) return

    setIsSavingDraft(true)
    try {
      localStorage.setItem('advancedRoleDraft', JSON.stringify(roleData))
    } catch (error) {
      console.error('Error saving draft:', error)
    } finally {
      setIsSavingDraft(false)
    }
  }

  const canProceedToStep = (stepId: number): boolean => {
    switch (stepId) {
      case 1: return true // Always can start
      case 2: return !!roleData.step1 // Need job details
      case 3: return !!roleData.step1 && !!roleData.step2 // Need requirements
      case 4: return !!roleData.step1 && !!roleData.step2 // Skills optional
      case 5: return !!roleData.step1 && !!roleData.step2 // Bonus/penalty optional
      default: return false
    }
  }

  const createRole = async () => {
    if (!roleData.step1 || !roleData.step2) {
      toast.error("Please complete required steps (Job Details & Requirements)")
      return
    }

    setIsLoading(true)
    
    try {
      // Combine all data into the new role structure
      const fullRoleData = {
        ...roleData.step1,
        ...roleData.step2,
        bonusConfig: roleData.step4?.bonusConfig || null,
        penaltyConfig: roleData.step4?.penaltyConfig || null
      }
      
      console.log('Creating advanced role with data:', fullRoleData)
      
      const roleResponse = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fullRoleData),
      })

      if (!roleResponse.ok) {
        const errorData = await roleResponse.json()
        console.error('Role creation error:', errorData)
        throw new Error(errorData.message || 'Failed to create role')
      }

      const { data: createdRole } = await roleResponse.json()
      console.log('Advanced role created successfully with ID:', createdRole.id)

      // Add skills if provided
      if (roleData.step3.length > 0) {
        console.log('Adding skills:', roleData.step3.length)
        const skillPromises = roleData.step3.map(async (skill) => {
          try {
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
              console.error('Skill creation error')
            }
          } catch (error) {
            console.error('Failed to create skill:', error)
          }
        })

        await Promise.all(skillPromises)
      }

      // Add questions if provided
      if (roleData.step5.length > 0) {
        console.log('Adding questions:', roleData.step5.length)
        const questionPromises = roleData.step5.map(async (question) => {
          try {
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
              console.error('Question creation error')
            }
          } catch (error) {
            console.error('Failed to create question:', error)
          }
        })

        await Promise.all(questionPromises)
      }

      // Clear the draft
      localStorage.removeItem('advancedRoleDraft')
      
      toast.success("Advanced role created successfully!")
      router.push('/dashboard/roles')

    } catch (error) {
      console.error('Error creating advanced role:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create role')
    } finally {
      setIsLoading(false)
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
            initialData={roleData.step1 || undefined}
            onSubmit={(data) => {
              updateStepData('step1', data)
              nextStep()
            }}
            isLoading={isLoading}
          />
        )
      case 2:
        return (
          <RequirementsForm
            initialData={roleData.step2 || undefined}
            onSubmit={(data) => {
              updateStepData('step2', data)
              nextStep()
            }}
            onPrevious={previousStep}
            isLoading={isLoading}
          />
        )
      case 3:
        return (
          <SkillsMatrix
            initialSkills={roleData.step3}
            onSubmit={(skills) => {
              updateStepData('step3', skills)
              nextStep()
            }}
            onPrevious={previousStep}
            onSkip={skipStep}
            isLoading={isLoading}
          />
        )
      case 4:
        return (
          <BonusPenaltyConfig
            initialData={roleData.step4 || undefined}
            onSubmit={(data) => {
              updateStepData('step4', data)
              nextStep()
            }}
            onPrevious={previousStep}
            onSkip={skipStep}
            isLoading={isLoading}
          />
        )
      case 5:
        return (
          <QuestionsBuilder
            initialQuestions={roleData.step5}
            onSubmit={(questions) => {
              updateStepData('step5', questions)
              // This is the final step, so create the role
              createRole()
            }}
            onPrevious={previousStep}
            onSkip={() => createRole()} // Skip questions and create role
            isLoading={isLoading}
            isFinalStep={true}
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
        <div className="text-center mb-8 relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
                localStorage.removeItem('advancedRoleDraft')
                router.push('/dashboard/roles')
              }
            }}
            className="absolute top-0 right-0 text-gray-500 hover:text-gray-700"
          >
            ✕ Cancel
          </Button>
          
          <h1 className="text-3xl font-bold text-gray-900">
            {isEditing ? 'Edit Advanced Role' : 'Create Advanced Role'}
          </h1>
          <p className="mt-2 text-gray-600">
            New sophisticated scoring system with bonus/penalty modules
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
                  <Save className="h-4 w-4 text-blue-600 animate-pulse" />
                  <span className="text-sm text-blue-600">Auto-saving...</span>
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
              {STEPS.map((step, index) => {
                const status = getStepStatus(step.id)
                const isAccessible = canProceedToStep(step.id)
                return (
                  <li key={step.id} className="relative flex-1">
                    <div className="flex items-center">
                      <div 
                        className={`
                          relative flex items-center justify-center cursor-pointer
                          ${isAccessible ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
                        `}
                        onClick={() => isAccessible && setCurrentStep(step.id)}
                      >
                        <div
                          className={`
                            flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all
                            ${status === 'completed' 
                              ? 'bg-green-600 border-green-600' 
                              : status === 'current'
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-gray-300 bg-white'
                            }
                          `}
                        >
                          {status === 'completed' ? (
                            <CheckCircle className="h-6 w-6 text-white" />
                          ) : (
                            <span
                              className={`
                                text-sm font-bold
                                ${status === 'current' ? 'text-blue-600' : 'text-gray-500'}
                              `}
                            >
                              {step.id}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 min-w-0 flex-1">
                        <p className={`text-sm font-medium ${status === 'current' ? 'text-blue-600' : status === 'completed' ? 'text-green-600' : 'text-gray-500'}`}>
                          {step.title}
                          {(step.id === 3 || step.id === 4 || step.id === 5) && (
                            <span className="text-xs text-gray-400 ml-1">(Optional)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{step.description}</p>
                      </div>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`
                          absolute top-5 left-10 -ml-px h-0.5 w-full
                          ${status === 'completed' ? 'bg-green-600' : 'bg-gray-300'}
                        `}
                      />
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        </div>

        {/* Step Info Badge */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
            {STEPS[currentStep - 1].title}
            {(currentStep === 3 || currentStep === 4 || currentStep === 5) && (
              <span className="ml-2 px-2 py-0.5 bg-blue-200 rounded-full text-xs">Optional</span>
            )}
          </div>
        </div>

        {/* Current Step Content */}
        <div className="mb-8">
          {renderCurrentStep()}
        </div>

        {/* Help Text */}
        <div className="text-center text-sm text-gray-500 mt-8">
          <p>
            💡 Tip: Steps 3-5 are optional but will enable our advanced AI scoring system with 
            sophisticated bonus/penalty calculations for more accurate candidate evaluation.
          </p>
        </div>
      </div>
    </div>
  )
}