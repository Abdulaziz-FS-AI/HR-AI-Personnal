"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { ArrowRight, Briefcase } from "lucide-react"
import { jobDetailsStepSchema, type JobDetailsStep } from "@/lib/validations/role"

interface JobDetailsFormProps {
  initialData?: JobDetailsStep
  onSubmit: (data: JobDetailsStep) => void
  isLoading?: boolean
}

export function JobDetailsForm({ initialData, onSubmit, isLoading }: JobDetailsFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<JobDetailsStep>({
    resolver: zodResolver(jobDetailsStepSchema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      responsibilities: initialData?.responsibilities || ''
    }
  })

  const handleSubmit = async (data: JobDetailsStep) => {
    setIsSubmitting(true)
    try {
      onSubmit(data)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Briefcase className="h-6 w-6 text-blue-600" />
          <CardTitle className="text-2xl font-bold">Job Details</CardTitle>
        </div>
        <p className="text-muted-foreground">
          Step 1 of 5: Define the basic information about this role
        </p>
      </CardHeader>
      
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            
            {/* Job Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">
                    Job Title <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Senior Software Engineer, Marketing Manager, Data Scientist"
                      className="text-base h-12"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-gray-500 mt-1">
                    Choose a clear, specific title that accurately reflects the role and seniority level
                  </p>
                </FormItem>
              )}
            />

            {/* Job Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">
                    Job Description <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide an overview of the role, team structure, company culture, and what makes this position exciting. This helps candidates understand the context and our AI evaluate cultural fit."
                      className="min-h-[120px] text-base"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <div className="text-sm text-gray-500 mt-1">
                    <p>💡 <strong>Pro tip:</strong> Include information about:</p>
                    <ul className="list-disc ml-6 mt-1 space-y-1">
                      <li>Team size and structure</li>
                      <li>Company culture and values</li>
                      <li>Growth opportunities</li>
                      <li>Technology stack or tools used</li>
                    </ul>
                  </div>
                </FormItem>
              )}
            />

            {/* Key Responsibilities */}
            <FormField
              control={form.control}
              name="responsibilities"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">
                    Key Responsibilities
                    <span className="text-gray-400 font-normal ml-2">(Optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="List the main duties and responsibilities for this role. Use bullet points or numbered lists for clarity."
                      className="min-h-[100px] text-base"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-gray-500 mt-1">
                    Break down the day-to-day activities and key objectives of this position
                  </p>
                </FormItem>
              )}
            />

            {/* Progress Indicator */}
            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">1</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-900">What happens next?</h4>
                  <p className="text-blue-800 text-sm mt-1">
                    After completing job details, you'll define education and experience requirements. 
                    Then optionally configure our advanced AI scoring system with skills, bonuses, and custom questions.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="flex justify-end pt-6">
              <Button
                type="submit"
                disabled={isLoading || isSubmitting || !form.formState.isValid}
                className="min-w-[200px] h-12 text-base font-semibold"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    Continue to Requirements
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}