"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  jobDetailsStepSchema, 
  type JobDetailsStep 
} from "@/lib/validations/role"

interface JobDetailsFormProps {
  initialData?: Partial<JobDetailsStep>
  onSubmit: (data: JobDetailsStep) => void
  onNext: () => void
  isLoading?: boolean
}

export function JobDetailsForm({ 
  initialData, 
  onSubmit, 
  onNext, 
  isLoading = false 
}: JobDetailsFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<JobDetailsStep>({
    resolver: zodResolver(jobDetailsStepSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      responsibilities: initialData?.responsibilities || "",
      department: initialData?.department || "",
      location: initialData?.location || "",
    }
  })

  const { 
    register, 
    handleSubmit, 
    formState: { errors, isValid }
  } = form

  const handleFormSubmit = async (data: JobDetailsStep) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      onNext()
    } catch (error) {
      console.error('Form submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Job Details
        </CardTitle>
        <p className="text-center text-muted-foreground">
          Step 1 of 5: Define the basic job information
        </p>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Job Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Job Title *
            </Label>
            <Input
              id="title"
              placeholder="e.g., Senior React Developer"
              {...register("title")}
              className={errors.title ? "border-red-500" : ""}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title.message}</p>
            )}
          </div>

          {/* Two column layout for department and location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department" className="text-sm font-medium">
                Department
              </Label>
              <Input
                id="department"
                placeholder="e.g., Engineering"
                {...register("department")}
                className={errors.department ? "border-red-500" : ""}
              />
              {errors.department && (
                <p className="text-sm text-red-500">{errors.department.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-medium">
                Location
              </Label>
              <Input
                id="location"
                placeholder="e.g., Remote, New York, NY"
                {...register("location")}
                className={errors.location ? "border-red-500" : ""}
              />
              {errors.location && (
                <p className="text-sm text-red-500">{errors.location.message}</p>
              )}
            </div>
          </div>


          {/* Job Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Job Description
            </Label>
            <Textarea
              id="description"
              placeholder="Describe the role, what the candidate will be doing, team structure, etc."
              rows={4}
              {...register("description")}
              className={errors.description ? "border-red-500" : ""}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          {/* Responsibilities */}
          <div className="space-y-2">
            <Label htmlFor="responsibilities" className="text-sm font-medium">
              Key Responsibilities
            </Label>
            <Textarea
              id="responsibilities"
              placeholder="• Lead development of new features&#10;• Mentor junior developers&#10;• Collaborate with product and design teams"
              rows={4}
              {...register("responsibilities")}
              className={errors.responsibilities ? "border-red-500" : ""}
            />
            {errors.responsibilities && (
              <p className="text-sm text-red-500">{errors.responsibilities.message}</p>
            )}
          </div>


          {/* Action Buttons */}
          <div className="flex justify-between pt-6">
            <div /> {/* Empty div for spacing */}
            
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
                {isSubmitting ? "Saving..." : "Next Step"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}