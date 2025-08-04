"use client"

import { useState } from "react"
import { useFieldArray, useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, X, AlertCircle, GraduationCap, Briefcase, Settings } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { z } from "zod"

// Requirements categories
export const requirementCategories = [
  { value: "education", label: "Education", icon: GraduationCap, color: "bg-blue-100 text-blue-800" },
  { value: "experience", label: "Experience", icon: Briefcase, color: "bg-green-100 text-green-800" },
  { value: "other", label: "Other", icon: Settings, color: "bg-purple-100 text-purple-800" }
] as const

export type RequirementCategory = typeof requirementCategories[number]["value"]

export interface Requirement {
  id?: string
  requirementText: string
  weight: number
  isRequired: boolean
  category: RequirementCategory
}

// Validation schema
const requirementsStepSchema = z.object({
  requirements: z.array(
    z.object({
      requirementText: z.string().min(1, "Requirement text is required"),
      weight: z.number().min(1).max(10),
      isRequired: z.boolean(),
      category: z.enum(["education", "experience", "other"])
    })
  ) // Remove .min(1) to allow empty arrays
})

interface RequirementsMatrixProps {
  initialRequirements?: Requirement[]
  onSubmit: (requirements: Requirement[]) => void
  onNext: () => void
  onPrevious: () => void
  isLoading?: boolean
}

interface RequirementFormData {
  requirements: Array<{
    requirementText: string
    weight: number
    isRequired: boolean
    category: RequirementCategory
  }>
}

export function RequirementsMatrix({ 
  initialRequirements = [], 
  onSubmit, 
  onNext, 
  onPrevious,
  isLoading = false 
}: RequirementsMatrixProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<RequirementFormData>({
    resolver: zodResolver(requirementsStepSchema),
    defaultValues: {
      requirements: initialRequirements.length > 0 
        ? initialRequirements.map(req => ({
            requirementText: req.requirementText,
            weight: req.weight,
            isRequired: req.isRequired,
            category: req.category
          }))
        : [{ requirementText: "", weight: 5, isRequired: false, category: "education" as RequirementCategory }]
    }
  })

  const { control, handleSubmit, watch, formState: { errors, isValid } } = form

  const { fields, append, remove } = useFieldArray({
    control,
    name: "requirements"
  })

  const watchedRequirements = watch("requirements")

  const addRequirement = (category?: RequirementCategory) => {
    append({ 
      requirementText: "", 
      weight: 5, 
      isRequired: false, 
      category: category || "education" 
    })
  }

  const removeRequirement = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }

  const handleFormSubmit = async (data: RequirementFormData) => {
    setIsSubmitting(true)
    try {
      const requirements = data.requirements.map(req => ({
        requirementText: req.requirementText,
        weight: req.weight,
        isRequired: req.isRequired,
        category: req.category
      }))
      
      // Show warning if no requirements added, but still proceed
      if (requirements.length === 0) {
        toast.warning("No requirements added - you can add them later if needed")
      }
      
      await onSubmit(requirements)
      onNext()
    } catch (error) {
      console.error('Requirements submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getCategoryIcon = (category: RequirementCategory) => {
    const categoryData = requirementCategories.find(c => c.value === category)
    if (!categoryData) return null
    const Icon = categoryData.icon
    return <Icon className="w-4 h-4" />
  }

  const getCategoryColor = (category: RequirementCategory) => {
    return requirementCategories.find(c => c.value === category)?.color || "bg-gray-100 text-gray-800"
  }

  const groupedRequirements = requirementCategories.map(category => ({
    ...category,
    requirements: watchedRequirements.filter((_, index) => 
      watchedRequirements[index]?.category === category.value
    ).map((req, reqIndex) => {
      const originalIndex = watchedRequirements.findIndex((r, i) => 
        watchedRequirements[i]?.category === category.value && 
        watchedRequirements.slice(0, i + 1).filter(r2 => r2?.category === category.value).length === reqIndex + 1
      )
      return { ...req, originalIndex }
    })
  }))

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Requirements & Qualifications
        </CardTitle>
        <p className="text-center text-muted-foreground">
          Step 2 of 5: Define education, experience, and other requirements
        </p>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
          
          {/* Quick Add Buttons */}
          <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 w-full mb-2">Quick Add:</p>
            {requirementCategories.map((category) => {
              const Icon = category.icon
              return (
                <Button
                  key={category.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addRequirement(category.value)}
                  className="flex items-center gap-2"
                >
                  <Icon className="w-4 h-4" />
                  Add {category.label}
                </Button>
              )
            })}
          </div>

          {/* Requirements by Category */}
          {groupedRequirements.map((categoryGroup) => (
            <div key={categoryGroup.value} className="space-y-4">
              <div className="flex items-center gap-2">
                <categoryGroup.icon className="w-5 h-5" />
                <h3 className="text-lg font-semibold">{categoryGroup.label} Requirements</h3>
                <Badge variant="secondary" className={categoryGroup.color}>
                  {categoryGroup.requirements.length}
                </Badge>
              </div>

              {categoryGroup.requirements.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                  <categoryGroup.icon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No {categoryGroup.label.toLowerCase()} requirements added yet</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addRequirement(categoryGroup.value)}
                    className="mt-2"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add {categoryGroup.label} Requirement
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {categoryGroup.requirements.map((req, reqIndex) => {
                    const fieldIndex = req.originalIndex
                    return (
                      <Card key={fieldIndex} className="p-4">
                        <div className="grid grid-cols-12 gap-4 items-start">
                          
                          {/* Requirement Text */}
                          <div className="col-span-5 space-y-2">
                            <Label className="text-sm font-medium">
                              Requirement Description
                            </Label>
                            <Controller
                              name={`requirements.${fieldIndex}.requirementText`}
                              control={control}
                              render={({ field }) => (
                                <Textarea
                                  {...field}
                                  placeholder={
                                    categoryGroup.value === "education" 
                                      ? "e.g., Bachelor's degree in Computer Science or related field"
                                      : categoryGroup.value === "experience"
                                      ? "e.g., 5+ years of experience in full-stack development"
                                      : "e.g., Strong communication and leadership skills"
                                  }
                                  rows={2}
                                  className={
                                    errors.requirements?.[fieldIndex]?.requirementText 
                                      ? "border-red-500" 
                                      : ""
                                  }
                                />
                              )}
                            />
                            {errors.requirements?.[fieldIndex]?.requirementText && (
                              <p className="text-sm text-red-500">
                                {errors.requirements[fieldIndex]?.requirementText?.message}
                              </p>
                            )}
                          </div>

                          {/* Category */}
                          <div className="col-span-2 space-y-2">
                            <Label className="text-sm font-medium">Category</Label>
                            <Controller
                              name={`requirements.${fieldIndex}.category`}
                              control={control}
                              render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {requirementCategories.map((cat) => (
                                      <SelectItem key={cat.value} value={cat.value}>
                                        <div className="flex items-center gap-2">
                                          <cat.icon className="w-4 h-4" />
                                          {cat.label}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>

                          {/* Weight */}
                          <div className="col-span-2 space-y-2">
                            <Label className="text-sm font-medium">
                              Weight ({req.weight}/10)
                            </Label>
                            <Controller
                              name={`requirements.${fieldIndex}.weight`}
                              control={control}
                              render={({ field }) => (
                                <div className="space-y-2">
                                  <Slider
                                    value={[field.value]}
                                    onValueChange={(value) => field.onChange(value[0])}
                                    max={10}
                                    min={1}
                                    step={1}
                                    className="w-full"
                                  />
                                  <div className="flex justify-between text-xs text-gray-500">
                                    <span>Low</span>
                                    <span>High</span>
                                  </div>
                                </div>
                              )}
                            />
                          </div>

                          {/* Required Toggle */}
                          <div className="col-span-2 space-y-2">
                            <Label className="text-sm font-medium">Priority</Label>
                            <Controller
                              name={`requirements.${fieldIndex}.isRequired`}
                              control={control}
                              render={({ field }) => (
                                <Button
                                  type="button"
                                  variant={field.value ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => field.onChange(!field.value)}
                                  className="w-full"
                                >
                                  {field.value ? "Required" : "Optional"}
                                </Button>
                              )}
                            />
                          </div>

                          {/* Remove Button */}
                          <div className="col-span-1 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRequirement(fieldIndex)}
                              disabled={fields.length <= 1}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Form Errors */}
          {errors.requirements && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="w-4 h-4" />
              <span>{errors.requirements.message || "Please fix the requirement errors above"}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between pt-6 border-t">
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
                disabled={!isValid || isSubmitting || isLoading}
                className="min-w-[120px]"
              >
                {isSubmitting ? "Saving..." : "Next: Skills"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}