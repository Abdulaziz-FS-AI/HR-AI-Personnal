"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { ArrowRight, ArrowLeft, GraduationCap, Clock } from "lucide-react"
import { requirementsStepSchema, type RequirementsStep } from "@/lib/validations/role"

interface RequirementsFormProps {
  initialData?: RequirementsStep
  onSubmit: (data: RequirementsStep) => void
  onPrevious: () => void
  isLoading?: boolean
}

export function RequirementsForm({ initialData, onSubmit, onPrevious, isLoading }: RequirementsFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<RequirementsStep>({
    resolver: zodResolver(requirementsStepSchema),
    defaultValues: {
      educationRequirements: initialData?.educationRequirements || '',
      experienceRequirements: initialData?.experienceRequirements || ''
    }
  })

  const handleSubmit = async (data: RequirementsStep) => {
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
          <GraduationCap className="h-6 w-6 text-green-600" />
          <CardTitle className="text-2xl font-bold">Requirements</CardTitle>
        </div>
        <p className="text-muted-foreground">
          Step 2 of 5: Define education and experience requirements
        </p>
      </CardHeader>
      
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            
            {/* Education Requirements */}
            <FormField
              control={form.control}
              name="educationRequirements"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    Education Requirements <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the educational background needed for this role. Our AI will parse this intelligently."
                      className="min-h-[100px] text-base"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <div className="bg-green-50 p-3 rounded-lg mt-2">
                    <p className="text-sm text-green-800 font-medium mb-2">💡 Examples of effective descriptions:</p>
                    <div className="space-y-1 text-sm text-green-700">
                      <p>• "Bachelor's degree in Computer Science, Engineering, or equivalent experience"</p>
                      <p>• "Master's degree in Marketing, Business, or related field preferred"</p>
                      <p>• "High school diploma required, technical certifications a plus"</p>
                      <p>• "PhD in Data Science, Statistics, Mathematics, or equivalent practical experience"</p>
                    </div>
                  </div>
                </FormItem>
              )}
            />

            {/* Experience Requirements */}
            <FormField
              control={form.control}
              name="experienceRequirements"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Experience Requirements <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the professional experience needed. Include years, type of experience, and any specific industry knowledge."
                      className="min-h-[100px] text-base"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <div className="bg-blue-50 p-3 rounded-lg mt-2">
                    <p className="text-sm text-blue-800 font-medium mb-2">💡 Examples of effective descriptions:</p>
                    <div className="space-y-1 text-sm text-blue-700">
                      <p>• "5-7 years of backend development experience with Python or Java"</p>
                      <p>• "3+ years in digital marketing with focus on SEM and social media"</p>
                      <p>• "Entry level position, 0-2 years experience, strong willingness to learn"</p>
                      <p>• "10+ years senior leadership experience in technology companies"</p>
                      <p>• "2-4 years experience in data analysis, preferably in healthcare or finance"</p>
                    </div>
                  </div>
                </FormItem>
              )}
            />

            {/* AI Enhancement Note */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">AI</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">How our AI uses these requirements</h4>
                  <p className="text-gray-700 text-sm mt-1">
                    Our advanced AI will intelligently parse your plain-text requirements and evaluate candidates based on:
                  </p>
                  <ul className="list-disc ml-4 mt-2 text-sm text-gray-600 space-y-1">
                    <li>Degree level and field relevance for education</li>
                    <li>Years of experience and industry matching</li>
                    <li>Alternative qualifications and equivalent experience</li>
                    <li>Context-aware evaluation (startup vs enterprise, junior vs senior roles)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Progress Indicator */}
            <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">2</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-green-900">What's next?</h4>
                  <p className="text-green-800 text-sm mt-1">
                    Great! You've completed the required steps. The next 3 steps are optional but will unlock 
                    our advanced AI scoring system with sophisticated bonus/penalty calculations for more accurate evaluations.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onPrevious}
                disabled={isLoading || isSubmitting}
                className="min-w-[150px] h-12"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous Step
              </Button>
              
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
                    Continue to Skills
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