"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle, Lightbulb, ArrowRight, ArrowLeft } from "lucide-react"
import { 
  requirementsStepSchema, 
  type RequirementsStep 
} from "@/lib/validations/role"

interface RequirementsFormProps {
  initialData?: Partial<RequirementsStep>
  onSubmit: (data: RequirementsStep) => void
  onNext: () => void
  onPrevious: () => void
  isLoading?: boolean
}

export function RequirementsForm({ 
  initialData, 
  onSubmit, 
  onNext, 
  onPrevious,
  isLoading = false 
}: RequirementsFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<RequirementsStep>({
    resolver: zodResolver(requirementsStepSchema),
    defaultValues: {
      educationRequirements: {
        hasRequirements: initialData?.educationRequirements?.hasRequirements ?? true,
        requirements: initialData?.educationRequirements?.requirements || ""
      },
      experienceRequirements: {
        hasRequirements: initialData?.experienceRequirements?.hasRequirements ?? true,
        requirements: initialData?.experienceRequirements?.requirements || ""
      }
    },
    mode: "onChange"
  })

  const { 
    register, 
    handleSubmit, 
    watch,
    setValue,
    formState: { errors, isValid, isDirty }
  } = form

  const educationHasRequirements = watch("educationRequirements.hasRequirements")
  const experienceHasRequirements = watch("experienceRequirements.hasRequirements")
  const educationRequirements = watch("educationRequirements.requirements")
  const experienceRequirements = watch("experienceRequirements.requirements")

  const handleFormSubmit = async (data: RequirementsStep) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      onNext()
    } catch (error) {
      console.error('Requirements form submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }


  const getValidationStatus = () => {
    if (!educationHasRequirements && !experienceHasRequirements) {
      return { type: "entry-level", message: "Entry-level position (no specific requirements)" }
    }
    if (errors.educationRequirements || errors.experienceRequirements) {
      return { type: "error", message: "Please complete all required fields" }
    }
    if (isValid) {
      return { type: "success", message: "Requirements properly configured" }
    }
    return { type: "pending", message: "Configure your requirements" }
  }

  const validationStatus = getValidationStatus()

  return (
    <Card className="w-full max-w-5xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Role Requirements
        </CardTitle>
        <p className="text-center text-muted-foreground">
          Step 2 of 6: Define education and experience requirements
        </p>
        
        {/* Status Indicator */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {validationStatus.type === "success" && (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-600 font-medium">{validationStatus.message}</span>
            </>
          )}
          {validationStatus.type === "error" && (
            <>
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-600 font-medium">{validationStatus.message}</span>
            </>
          )}
          {validationStatus.type === "entry-level" && (
            <>
              <Lightbulb className="h-5 w-5 text-blue-600" />
              <span className="text-blue-600 font-medium">{validationStatus.message}</span>
            </>
          )}
          {validationStatus.type === "pending" && (
            <span className="text-gray-500 font-medium">{validationStatus.message}</span>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
          {/* Education Requirements Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">📚 Education Requirements</h3>
                <p className="text-sm text-gray-600">Specify education requirements for this role</p>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="education-toggle" className={educationHasRequirements ? "text-gray-900" : "text-gray-500"}>
                  {educationHasRequirements ? "Education Required" : "Education Not Required"}
                </Label>
                <Switch
                  id="education-toggle"
                  checked={educationHasRequirements}
                  onCheckedChange={(checked) => {
                    setValue("educationRequirements.hasRequirements", checked, { shouldValidate: true })
                    if (!checked) {
                      setValue("educationRequirements.requirements", "", { shouldValidate: true })
                    }
                  }}
                />
              </div>
            </div>

            {educationHasRequirements ? (
              <div className="space-y-3">
                <Label htmlFor="education-requirements" className="text-sm font-medium">
                  Education Requirements *
                </Label>

                <Textarea
                  id="education-requirements"
                  placeholder="e.g., Bachelor's degree in Computer Science or related field required. Master's degree preferred."
                  rows={3}
                  {...register("educationRequirements.requirements")}
                  className={errors.educationRequirements?.requirements ? "border-red-500" : ""}
                />
                {errors.educationRequirements?.requirements && (
                  <p className="text-sm text-red-500">{errors.educationRequirements.requirements.message}</p>
                )}
                <div className="text-xs text-gray-500">
                  Character count: {educationRequirements.length}/500
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <Lightbulb className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 font-medium">No Education Requirements</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Great for entry-level positions or roles where experience matters more than formal education
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Experience Requirements Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">💼 Experience Requirements</h3>
                <p className="text-sm text-gray-600">Specify experience requirements for this role</p>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="experience-toggle" className={experienceHasRequirements ? "text-gray-900" : "text-gray-500"}>
                  {experienceHasRequirements ? "Experience Required" : "Experience Not Required"}
                </Label>
                <Switch
                  id="experience-toggle"
                  checked={experienceHasRequirements}
                  onCheckedChange={(checked) => {
                    setValue("experienceRequirements.hasRequirements", checked, { shouldValidate: true })
                    if (!checked) {
                      setValue("experienceRequirements.requirements", "", { shouldValidate: true })
                    }
                  }}
                />
              </div>
            </div>

            {experienceHasRequirements ? (
              <div className="space-y-3">
                <Label htmlFor="experience-requirements" className="text-sm font-medium">
                  Experience Requirements *
                </Label>

                <Textarea
                  id="experience-requirements"
                  placeholder="e.g., 3-5 years of professional software development experience. Experience with modern web frameworks required."
                  rows={3}
                  {...register("experienceRequirements.requirements")}
                  className={errors.experienceRequirements?.requirements ? "border-red-500" : ""}
                />
                {errors.experienceRequirements?.requirements && (
                  <p className="text-sm text-red-500">{errors.experienceRequirements.requirements.message}</p>
                )}
                <div className="text-xs text-gray-500">
                  Character count: {experienceRequirements.length}/500
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <Lightbulb className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 font-medium">No Experience Requirements</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Perfect for entry-level positions, career changers, or when skills matter more than years of experience
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Summary Section */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Requirements Summary</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={educationHasRequirements ? "default" : "secondary"}>
                  Education: {educationHasRequirements ? "Required" : "Not Required"}
                </Badge>
                <Badge variant={experienceHasRequirements ? "default" : "secondary"}>
                  Experience: {experienceHasRequirements ? "Required" : "Not Required"}
                </Badge>
              </div>
              <p className="text-sm text-blue-700">
                {!educationHasRequirements && !experienceHasRequirements
                  ? "This role is perfect for entry-level candidates and career changers."
                  : educationHasRequirements && experienceHasRequirements
                  ? "This role requires both specific education and experience qualifications."
                  : educationHasRequirements
                  ? "This role prioritizes education over experience."
                  : "This role prioritizes experience over formal education."
                }
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onPrevious}
              disabled={isSubmitting || isLoading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
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
                {isSubmitting ? "Saving..." : (
                  <>
                    Next Step
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}