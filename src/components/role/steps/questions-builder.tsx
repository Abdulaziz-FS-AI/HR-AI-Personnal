"use client"

import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, ArrowLeft, MessageCircleQuestion, Plus, Minus, Skip, CheckCircle, Sparkles } from "lucide-react"
import { questionsStepSchema, type QuestionsStep, type Question, questionTypes } from "@/lib/validations/role"

interface QuestionsBuilderProps {
  initialQuestions?: Question[]
  onSubmit: (questions: Question[]) => void
  onPrevious: () => void
  onSkip: () => void
  isLoading?: boolean
  isFinalStep?: boolean
}

export function QuestionsBuilder({ 
  initialQuestions = [], 
  onSubmit, 
  onPrevious, 
  onSkip, 
  isLoading,
  isFinalStep = false 
}: QuestionsBuilderProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<QuestionsStep>({
    resolver: zodResolver(questionsStepSchema),
    defaultValues: {
      questions: initialQuestions.length > 0 ? initialQuestions : []
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "questions"
  })

  const handleSubmit = async (data: QuestionsStep) => {
    setIsSubmitting(true)
    try {
      // Filter out questions with empty text
      const validQuestions = data.questions.filter(q => q.questionText.trim() !== '')
      onSubmit(validQuestions)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addQuestion = () => {
    append({ 
      questionText: '', 
      weight: 5, 
      category: 'Technical',
      expectedAnswer: ''
    })
  }

  const removeQuestion = (index: number) => {
    remove(index)
  }

  const getWeightLabel = (weight: number) => {
    if (weight >= 9) return "Critical"
    if (weight >= 7) return "Important" 
    if (weight >= 5) return "Moderate"
    if (weight >= 3) return "Nice to know"
    return "Optional"
  }

  const getWeightColor = (weight: number) => {
    if (weight >= 9) return "text-red-600"
    if (weight >= 7) return "text-orange-600"
    if (weight >= 5) return "text-blue-600"
    if (weight >= 3) return "text-green-600"
    return "text-gray-600"
  }

  const watchedQuestions = form.watch("questions")
  const totalQuestionsCount = watchedQuestions.filter(q => q.questionText.trim() !== '').length

  const sampleQuestions = [
    {
      category: "Technical",
      text: "Describe your experience with microservices architecture and how you've implemented service communication.",
      type: "Technical Depth"
    },
    {
      category: "Problem Solving", 
      text: "Walk me through how you would optimize a slow-performing database query that affects thousands of users.",
      type: "Problem Solving"
    },
    {
      category: "Leadership",
      text: "Tell me about a time you had to lead a team through a difficult technical challenge or tight deadline.",
      type: "Behavioral"
    },
    {
      category: "Cultural Fit",
      text: "How do you stay current with new technologies and industry trends in your field?",
      type: "Growth Mindset"
    }
  ]

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <MessageCircleQuestion className="h-6 w-6 text-green-600" />
          <CardTitle className="text-2xl font-bold">Custom Questions</CardTitle>
          <Badge variant="secondary" className="ml-2">Optional</Badge>
        </div>
        <p className="text-muted-foreground">
          Step 5 of 5: Add role-specific evaluation questions {isFinalStep && "(Final Step)"}
        </p>
      </CardHeader>
      
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            
            {/* Questions Configuration */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircleQuestion className="h-5 w-5 text-green-600" />
                  <h3 className="text-xl font-semibold">Evaluation Questions</h3>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Total Questions: <Badge variant="outline">{totalQuestionsCount}</Badge></span>
                </div>
              </div>

              {/* Sample Questions for Inspiration */}
              {fields.length === 0 && (
                <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border border-green-200">
                  <div className="flex items-start gap-3 mb-4">
                    <Sparkles className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-gray-900">Question Ideas & Examples</h4>
                      <p className="text-gray-700 text-sm mt-1">
                        Here are some effective evaluation questions you might consider adding:
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid gap-3">
                    {sampleQuestions.map((sample, index) => (
                      <div key={index} className="bg-white p-3 rounded border-l-4 border-green-500">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 mb-1">"{sample.text}"</p>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-xs">{sample.category}</Badge>
                              <Badge variant="secondary" className="text-xs">{sample.type}</Badge>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => append({
                              questionText: sample.text,
                              weight: 5,
                              category: sample.category as any,
                              expectedAnswer: ''
                            })}
                            className="text-xs px-2 py-1 h-auto"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Use
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Questions List */}
              {fields.length > 0 && (
                <div className="space-y-6">
                  {fields.map((field, index) => (
                    <div key={field.id} className="border rounded-lg p-6 bg-gray-50">
                      <div className="space-y-4">
                        
                        {/* Question Header */}
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </span>
                            Question {index + 1}
                          </h4>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeQuestion(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          
                          {/* Question Text */}
                          <div className="md:col-span-2">
                            <FormField
                              control={form.control}
                              name={`questions.${index}.questionText`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">
                                    Question Text <span className="text-red-500">*</span>
                                  </FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Enter your evaluation question. Focus on specific skills, experiences, or scenarios relevant to this role."
                                      className="min-h-[80px]"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Category */}
                          <div>
                            <FormField
                              control={form.control}
                              name={`questions.${index}.category`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">Category</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {questionTypes.map((type) => (
                                        <SelectItem key={type} value={type}>
                                          {type}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Weight */}
                          <div>
                            <FormField
                              control={form.control}
                              name={`questions.${index}.weight`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">
                                    Importance (1-10)
                                  </FormLabel>
                                  <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={field.value?.toString()}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {[...Array(10)].map((_, i) => {
                                        const weight = i + 1
                                        return (
                                          <SelectItem key={weight} value={weight.toString()}>
                                            <div className="flex items-center gap-2">
                                              <span>{weight}</span>
                                              <span className={`text-xs ${getWeightColor(weight)}`}>
                                                {getWeightLabel(weight)}
                                              </span>
                                            </div>
                                          </SelectItem>
                                        )
                                      })}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Expected Answer */}
                          <div className="md:col-span-2">
                            <FormField
                              control={form.control}
                              name={`questions.${index}.expectedAnswer`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">
                                    Expected Answer/Key Points
                                    <span className="text-gray-400 font-normal ml-2">(Optional - helps AI evaluation)</span>
                                  </FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Describe what you're looking for in a good answer. Include key points, technologies, methodologies, or examples you'd expect to hear."
                                      className="min-h-[60px]"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                  <p className="text-xs text-gray-500 mt-1">
                                    💡 This helps our AI provide more accurate evaluations of candidate responses
                                  </p>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Weight Visual Indicator */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Importance:</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-32">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                watchedQuestions[index]?.weight >= 9 ? 'bg-red-500' :
                                watchedQuestions[index]?.weight >= 7 ? 'bg-orange-500' :
                                watchedQuestions[index]?.weight >= 5 ? 'bg-blue-500' :
                                watchedQuestions[index]?.weight >= 3 ? 'bg-green-500' : 'bg-gray-400'
                              }`}
                              style={{ width: `${(watchedQuestions[index]?.weight || 1) * 10}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${getWeightColor(watchedQuestions[index]?.weight || 1)}`}>
                            {getWeightLabel(watchedQuestions[index]?.weight || 1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Question Button */}
              <Button
                type="button"
                variant="outline"
                onClick={addQuestion}
                className="w-full h-12 border-dashed border-2 border-gray-300 hover:border-gray-400"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Custom Question
              </Button>
            </div>

            {/* AI Enhancement Note */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">AI</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">How AI uses your questions</h4>
                  <p className="text-gray-700 text-sm mt-1">
                    Our AI will evaluate candidates against your custom questions by analyzing their resumes for:
                  </p>
                  <ul className="list-disc ml-4 mt-2 text-sm text-gray-600 space-y-1">
                    <li>Relevant experience that demonstrates knowledge of the question topic</li>
                    <li>Projects, achievements, or roles that align with expected answers</li>
                    <li>Skills and technologies mentioned that relate to the question</li>
                    <li>Overall context that suggests the candidate could answer effectively</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Configuration Summary */}
            {totalQuestionsCount > 0 && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">Questions Summary</h4>
                <p className="text-green-800 text-sm">
                  You've created {totalQuestionsCount} custom question{totalQuestionsCount !== 1 ? 's' : ''} 
                  that will be evaluated as part of the advanced AI scoring system. These questions will help 
                  provide more targeted and role-specific candidate assessments.
                </p>
              </div>
            )}

            {/* Final Step Indicator */}
            {isFinalStep && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border-l-4 border-green-500">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-green-900">Ready to create your advanced role!</h4>
                    <p className="text-green-800 text-sm mt-1">
                      You've completed all configuration steps. Your role will be created with the sophisticated 
                      AI scoring system including all bonuses, penalties, and custom evaluation criteria.
                    </p>
                  </div>
                </div>
              </div>
            )}

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

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSkip}
                  disabled={isLoading || isSubmitting}
                  className="min-w-[140px] h-12"
                >
                  <Skip className="mr-2 h-4 w-4" />
                  {isFinalStep ? 'Skip & Create' : 'Skip Step'}
                </Button>
                
                <Button
                  type="submit"
                  disabled={isLoading || isSubmitting}
                  className="min-w-[200px] h-12 text-base font-semibold bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating Role...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Create Advanced Role
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}