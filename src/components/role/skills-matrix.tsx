"use client"

import { useState } from "react"
import { useFieldArray, useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, X, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  skillsStepSchema,
  skillCategories,
  type Skill
} from "@/lib/validations/role"

interface SkillsMatrixProps {
  initialSkills?: Skill[]
  onSubmit: (skills: Skill[]) => void
  onNext: () => void
  onPrevious: () => void
  isLoading?: boolean
}

interface SkillFormData {
  skills: Array<{
    skillName: string
    weight: number
    isRequired?: boolean
    skillCategory?: string
  }>
}

export function SkillsMatrix({ 
  initialSkills = [], 
  onSubmit, 
  onNext, 
  onPrevious,
  isLoading = false 
}: SkillsMatrixProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<SkillFormData>({
    resolver: zodResolver(skillsStepSchema),
    mode: "onChange", // Validate on change
    defaultValues: {
      skills: initialSkills.length > 0 
        ? initialSkills.map(skill => ({
            skillName: skill.skillName,
            weight: skill.weight,
            isRequired: skill.isRequired || false,
            skillCategory: skill.skillCategory || ""
          }))
        : [{ skillName: "", weight: 5, isRequired: false, skillCategory: "" }]
    }
  })

  const { control, handleSubmit, watch, setValue, formState: { errors, isValid } } = form

  const { fields, append, remove } = useFieldArray({
    control,
    name: "skills"
  })

  const watchedSkills = watch("skills")

  // Constants for limits
  const MAX_SKILLS = 15
  const MAX_REQUIRED_SKILLS = 10

  // Calculate current counts
  const validSkills = watchedSkills.filter(skill => skill.skillName && skill.skillName.trim() !== "")
  const requiredSkillsCount = validSkills.filter(skill => skill.isRequired).length
  const totalSkillsCount = fields.length

  const addSkill = () => {
    if (totalSkillsCount >= MAX_SKILLS) {
      toast.error(`Maximum ${MAX_SKILLS} skills allowed per role`)
      return
    }
    append({ skillName: "", weight: 5, isRequired: false, skillCategory: "" })
  }

  const removeSkill = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }

  const handleFormSubmit = async (data: SkillFormData) => {
    setIsSubmitting(true)
    try {
      // Filter out empty skills (skills with no name)
      const validSkills = data.skills.filter(skill => skill.skillName.trim() !== "")
      
      const skills = validSkills.map(skill => ({
        skillName: skill.skillName,
        weight: skill.weight,
        isRequired: skill.isRequired || false,
        skillCategory: skill.skillCategory || "",
        roleId: "" // Will be set by parent component
      })) as Skill[]
      
      // Show warning if no skills added, but still proceed
      if (skills.length === 0) {
        toast.warning("No skills added - you can add them later if needed")
      }
      
      await onSubmit(skills)
      onNext()
    } catch (error) {
      console.error('Skills submission error:', error)
      toast.error("Failed to save skills. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const getWeightColor = (weight: number) => {
    if (weight >= 9) return "text-red-600 bg-red-50"
    if (weight >= 7) return "text-orange-600 bg-orange-50"
    if (weight >= 5) return "text-yellow-600 bg-yellow-50"
    return "text-green-600 bg-green-50"
  }

  const getWeightLabel = (weight: number) => {
    if (weight >= 9) return "Must-Have"
    if (weight >= 7) return "Important"
    if (weight >= 5) return "Preferred"
    return "Nice-to-Have"
  }

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Skills & Requirements
        </CardTitle>
        <p className="text-center text-muted-foreground">
          Step 3 of 5: Define the skills and their importance (1-10 scale)
        </p>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Skills Legend */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Must-Have (9-10)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span>Important (7-8)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span>Preferred (5-6)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Nice-to-Have (1-4)</span>
            </div>
          </div>

          {/* Skills List */}
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  {/* Skill Name */}
                  <div className="md:col-span-4">
                    <Label htmlFor={`skills.${index}.skillName`} className="text-sm font-medium">
                      Skill Name *
                    </Label>
                    <Controller
                      name={`skills.${index}.skillName`}
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          placeholder="e.g., Programming Language, Framework, Tool"
                          className={errors.skills?.[index]?.skillName ? "border-red-500" : ""}
                        />
                      )}
                    />
                    {errors.skills?.[index]?.skillName && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.skills[index]?.skillName?.message}
                      </p>
                    )}
                  </div>

                  {/* Skill Category */}
                  <div className="md:col-span-3">
                    <Label htmlFor={`skills.${index}.skillCategory`} className="text-sm font-medium">
                      Category
                    </Label>
                    <Controller
                      name={`skills.${index}.skillCategory`}
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {skillCategories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* Weight Slider */}
                  <div className="md:col-span-3">
                    <Label htmlFor={`skills.${index}.weight`} className="text-sm font-medium">
                      Importance Weight
                    </Label>
                    <div className="space-y-2">
                      <Controller
                        name={`skills.${index}.weight`}
                        control={control}
                        render={({ field }) => {
                          const isRequired = watchedSkills[index]?.isRequired || false
                          return (
                            <input
                              type="range"
                              min="1"
                              max="10"
                              step="1"
                              {...field}
                              disabled={isRequired}
                              onChange={(e) => {
                                if (isRequired) return // Don't allow changes when required
                                const newWeight = parseInt(e.target.value)
                                field.onChange(newWeight)
                                // If weight is lowered below 10, uncheck required
                                if (newWeight < 10 && watchedSkills[index]?.isRequired) {
                                  setValue(`skills.${index}.isRequired`, false)
                                }
                              }}
                              className={`w-full h-2 rounded-lg appearance-none transition-all ${
                                isRequired 
                                  ? 'bg-gray-400 cursor-not-allowed opacity-60' 
                                  : 'bg-gray-200 cursor-pointer hover:bg-gray-300'
                              }`}
                              style={{
                                background: isRequired
                                  ? 'linear-gradient(to right, #6B7280 0%, #6B7280 100%)'
                                  : `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(field.value / 10) * 100}%, #E5E7EB ${(field.value / 10) * 100}%, #E5E7EB 100%)`
                              }}
                            />
                          )
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>1</span>
                        <span>5</span>
                        <span>10</span>
                      </div>
                      {watchedSkills[index]?.isRequired && (
                        <div className="text-xs text-red-600 mt-1 font-medium bg-red-50 px-2 py-1 rounded border border-red-200">
                          🔒 Locked at 10 (Required skill)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Weight Display & Actions */}
                  <div className="md:col-span-2 flex items-center gap-2">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      watchedSkills[index]?.isRequired 
                        ? 'text-red-600 bg-red-50 border border-red-200' 
                        : getWeightColor(watchedSkills[index]?.weight || 5)
                    }`}>
                      {watchedSkills[index]?.weight || 5}/10
                      <br />
                      <span className="text-xs">
                        {watchedSkills[index]?.isRequired 
                          ? 'Required' 
                          : getWeightLabel(watchedSkills[index]?.weight || 5)
                        }
                      </span>
                    </div>
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeSkill(index)}
                      disabled={fields.length === 1}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Required Checkbox */}
                <div className="mt-3 flex items-center gap-2">
                  <Controller
                    name={`skills.${index}.isRequired`}
                    control={control}
                    render={({ field }) => (
                      <input
                        type="checkbox"
                        id={`skills.${index}.isRequired`}
                        checked={field.value}
                        onChange={(e) => {
                          const isChecked = e.target.checked
                          
                          // Check if trying to check required but already at max
                          if (isChecked && requiredSkillsCount >= MAX_REQUIRED_SKILLS) {
                            toast.error(`Maximum ${MAX_REQUIRED_SKILLS} required skills allowed per role`)
                            return
                          }
                          
                          field.onChange(isChecked)
                          // If required is checked, set weight to 10
                          if (isChecked) {
                            setValue(`skills.${index}.weight`, 10)
                          } else {
                            // If unchecked, allow user to change weight again (set to reasonable default)
                            setValue(`skills.${index}.weight`, 7)
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    )}
                  />
                  <Label htmlFor={`skills.${index}.isRequired`} className="text-sm">
                    This is a hard requirement (candidates must have this skill)
                    {requiredSkillsCount >= MAX_REQUIRED_SKILLS && !watchedSkills[index]?.isRequired && (
                      <span className="text-red-600 ml-2 text-xs">
                        (Max required skills reached)
                      </span>
                    )}
                  </Label>
                </div>
              </div>
            ))}
          </div>

          {/* Add Skill Button */}
          <div className="flex flex-col items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={addSkill}
              disabled={totalSkillsCount >= MAX_SKILLS}
              className={`flex items-center gap-2 ${
                totalSkillsCount >= MAX_SKILLS ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Plus className="h-4 w-4" />
              Add Another Skill
            </Button>
            
            {/* Skills limit indicator */}
            <div className="text-sm text-gray-500">
              {totalSkillsCount}/{MAX_SKILLS} skills added
              {totalSkillsCount >= MAX_SKILLS && (
                <span className="text-red-600 ml-2">
                  (Maximum reached)
                </span>
              )}
            </div>
          </div>

          {/* Validation Messages */}
          {errors.skills && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span>Please fix the errors above before continuing</span>
            </div>
          )}

          {fields.length === 0 && (
            <div className="flex items-center gap-2 text-blue-600 text-sm bg-blue-50 p-3 rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span>No skills added yet - you can add them now or continue and add them later</span>
            </div>
          )}

          {/* Summary */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Skills Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Total Skills:</span>
                <div className={`font-semibold ${
                  totalSkillsCount >= MAX_SKILLS ? 'text-red-600' : ''
                }`}>
                  {totalSkillsCount}/{MAX_SKILLS}
                </div>
              </div>
              <div>
                <span className="text-red-700">Must-Have:</span>
                <div className="font-semibold">
                  {watchedSkills.filter(skill => skill.weight >= 9).length}
                </div>
              </div>
              <div>
                <span className="text-orange-700">Important:</span>
                <div className="font-semibold">
                  {watchedSkills.filter(skill => skill.weight >= 7 && skill.weight < 9).length}
                </div>
              </div>
              <div>
                <span className="text-green-700">Required:</span>
                <div className={`font-semibold ${
                  requiredSkillsCount >= MAX_REQUIRED_SKILLS ? 'text-red-600' : ''
                }`}>
                  {requiredSkillsCount}
                </div>
              </div>
            </div>
            
            {/* Limit warnings */}
            {totalSkillsCount >= MAX_SKILLS && (
              <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>Maximum skills limit reached (15/15)</span>
              </div>
            )}
            
            {totalSkillsCount >= MAX_SKILLS - 2 && totalSkillsCount < MAX_SKILLS && (
              <div className="mt-3 flex items-center gap-2 text-orange-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>Approaching skills limit ({totalSkillsCount}/15)</span>
              </div>
            )}
            
            {requiredSkillsCount >= MAX_REQUIRED_SKILLS && (
              <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>Maximum required skills limit reached (10/10)</span>
              </div>
            )}
            
            {requiredSkillsCount >= MAX_REQUIRED_SKILLS - 2 && requiredSkillsCount < MAX_REQUIRED_SKILLS && (
              <div className="mt-3 flex items-center gap-2 text-orange-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>Approaching required skills limit ({requiredSkillsCount}/10)</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onPrevious}
              disabled={isSubmitting || isLoading}
            >
              Previous Step
            </Button>
            
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || isLoading}
              >
                Save Draft
              </Button>
              
              <Button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="min-w-[120px]"
              >
                {isSubmitting ? "Saving..." : "Next Step"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}