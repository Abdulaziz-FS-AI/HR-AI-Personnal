"use client"

import { useState } from "react"
import { useFieldArray, useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, X, AlertCircle, HelpCircle, CheckCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  questionsStepSchema,
  questionCategories,
  type Question
} from "@/lib/validations/role"

interface QuestionsBuilderProps {
  initialQuestions?: Question[]
  onSubmit: (questions: Question[]) => void
  onNext: () => void
  onPrevious: () => void
  isLoading?: boolean
}

interface QuestionFormData {
  questions: Array<{
    questionText: string
    weight: number
    category?: string
  }>
}

const suggestedQuestions = {
  Technical: [
    "Describe your experience with [specific technology/framework].",
    "How would you approach debugging a complex technical issue?",
    "Walk me through your development process for a new feature.",
    "What are some best practices you follow for code quality?"
  ],
  Behavioral: [
    "Tell me about a time when you had to work under pressure.",
    "Describe a situation where you had to overcome a significant challenge.",
    "How do you handle disagreements with team members?",
    "Give an example of when you took initiative on a project."
  ],
  Experience: [
    "What projects are you most proud of and why?",
    "Describe your experience working in [specific environment/industry].",
    "How has your role evolved in your current position?",
    "What motivates you in your day-to-day work?"
  ],
  Leadership: [
    "How do you approach mentoring junior team members?",
    "Describe a time when you had to make a difficult decision.",
    "How do you handle project deadlines and competing priorities?",
    "What's your approach to giving constructive feedback?"
  ]
}

export function QuestionsBuilder({ 
  initialQuestions = [], 
  onSubmit, 
  onNext, 
  onPrevious,
  isLoading = false 
}: QuestionsBuilderProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState<number | null>(null)

  const form = useForm<QuestionFormData>({
    resolver: zodResolver(questionsStepSchema),
    defaultValues: {
      questions: initialQuestions.length > 0 
        ? initialQuestions.map(q => ({
            questionText: q.questionText,
            weight: q.weight,
            category: q.category || ""
          }))
        : []
    }
  })

  const { control, handleSubmit, watch, setValue, formState: { errors } } = form

  const { fields, append, remove } = useFieldArray({
    control,
    name: "questions"
  })

  const watchedQuestions = watch("questions")

  const addQuestion = () => {
    if (fields.length >= 5) return // Prevent adding more than 5 questions
    console.log('Adding new question, current count:', fields.length)
    append({ questionText: "", weight: 5, category: "" })
  }

  const addSuggestedQuestion = (questionText: string, index: number) => {
    setValue(`questions.${index}.questionText`, questionText)
    setShowSuggestions(null)
  }

  const removeQuestion = (index: number) => {
    remove(index)
  }

  const handleFormSubmit = async (data: QuestionFormData) => {
    // Prevent double submission
    if (isSubmitting) {
      console.log('Already submitting, ignoring duplicate request')
      return
    }
    
    setIsSubmitting(true)
    try {
      // Filter out incomplete questions before submitting
      const validQuestions = data.questions.filter(q => 
        q.questionText && q.questionText.trim().length >= 5
      )
      
      const questions = validQuestions.map(q => ({
        questionText: q.questionText.trim(),
        weight: q.weight || 5,
        category: q.category || "",
        roleId: "" // Will be set by parent component
      })) as Question[]
      
      console.log('Submitting questions:', questions.length)
      onSubmit(questions)
      onNext()
    } catch (error) {
      console.error('Questions submission error:', error)
      setIsSubmitting(false) // Reset on error
    }
    // Note: Don't reset isSubmitting on success - let parent handle it
  }

  const getWeightColor = (weight: number) => {
    if (weight >= 8) return "text-red-600 bg-red-50"
    if (weight >= 6) return "text-orange-600 bg-orange-50"
    if (weight >= 4) return "text-yellow-600 bg-yellow-50"
    return "text-green-600 bg-green-50"
  }

  const getWeightLabel = (weight: number) => {
    if (weight >= 8) return "Critical"
    if (weight >= 6) return "Important"
    if (weight >= 4) return "Moderate"
    return "Optional"
  }

  const validateQuestion = (text: string) => {
    if (!text) return { isValid: false, message: "Question is required" }
    if (text.length < 5) return { isValid: false, message: "Question too short (min 5 chars)" }
    if (text.length > 200) return { isValid: false, message: "Question too long (max 200 chars)" }

    return { isValid: true, message: "Valid question" }
  }

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Custom Questions
        </CardTitle>
        <p className="text-center text-muted-foreground">
          Step 4 of 5: Add role-specific questions for candidate evaluation (optional)
        </p>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Questions Info */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <HelpCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 mb-1">About Custom Questions</h4>
                <p className="text-sm text-blue-700">
                  These questions will be used by our AI to evaluate candidates beyond their resume. 
                  Add role-specific questions that help assess cultural fit, problem-solving skills, and experience relevance.
                </p>
              </div>
            </div>
          </div>

          {/* Questions List */}
          {fields.length > 0 && (
            <div className="space-y-4">
              {fields.map((field, index) => {
                const validation = validateQuestion(watchedQuestions[index]?.questionText || "")
                
                return (
                  <div key={field.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="space-y-4">
                      {/* Question Text */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor={`questions.${index}.questionText`} className="text-sm font-medium">
                            Question {index + 1} *
                          </Label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowSuggestions(showSuggestions === index ? null : index)}
                              className="text-xs"
                            >
                              View Suggestions
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeQuestion(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <Controller
                          name={`questions.${index}.questionText`}
                          control={control}
                          render={({ field }) => (
                            <Textarea
                              {...field}
                              placeholder="e.g., Describe your experience with relevant technologies and methodologies."
                              rows={3}
                              className={errors.questions?.[index]?.questionText ? "border-red-500" : ""}
                            />
                          )}
                        />
                        
                        {/* Validation Display */}
                        <div className="flex items-center gap-2 mt-2">
                          {validation.isValid ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className={`text-xs ${validation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                            {validation.message}
                          </span>
                        </div>

                        {errors.questions?.[index]?.questionText && (
                          <p className="text-sm text-red-500 mt-1">
                            {errors.questions[index]?.questionText?.message}
                          </p>
                        )}
                      </div>

                      {/* Suggestions Panel */}
                      {showSuggestions === index && (
                        <div className="bg-white border rounded-lg p-3">
                          <h5 className="font-medium text-sm mb-2">Suggested Questions:</h5>
                          <div className="space-y-2">
                            {Object.entries(suggestedQuestions).map(([category, questions]) => (
                              <div key={category}>
                                <h6 className="text-xs font-medium text-gray-600 mb-1">{category}:</h6>
                                <div className="space-y-1 ml-2">
                                  {questions.map((suggestion, suggestionIndex) => (
                                    <button
                                      key={suggestionIndex}
                                      type="button"
                                      onClick={() => addSuggestedQuestion(suggestion, index)}
                                      className="text-xs text-left text-blue-600 hover:text-blue-800 block w-full hover:bg-blue-50 p-1 rounded"
                                    >
                                      {suggestion}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Category and Weight */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`questions.${index}.category`} className="text-sm font-medium">
                            Category
                          </Label>
                          <Controller
                            name={`questions.${index}.category`}
                            control={control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {questionCategories.map((category) => (
                                    <SelectItem key={category} value={category}>
                                      {category}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>

                        <div>
                          <Label htmlFor={`questions.${index}.weight`} className="text-sm font-medium">
                            Importance Weight
                          </Label>
                          <div className="space-y-2">
                            <Controller
                              name={`questions.${index}.weight`}
                              control={control}
                              render={({ field }) => (
                                <input
                                  type="range"
                                  min="1"
                                  max="10"
                                  step="1"
                                  {...field}
                                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                              )}
                            />
                            <div className="flex justify-between items-center">
                              <div className="flex justify-between text-xs text-gray-500 w-full">
                                <span>1</span>
                                <span>5</span>
                                <span>10</span>
                              </div>
                              <div className={`ml-4 px-2 py-1 rounded text-xs font-medium ${getWeightColor(watchedQuestions[index]?.weight || 5)}`}>
                                {watchedQuestions[index]?.weight || 5}/10
                                <br />
                                <span className="text-xs">
                                  {getWeightLabel(watchedQuestions[index]?.weight || 5)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add Question Button */}
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                addQuestion()
              }}
              disabled={fields.length >= 5}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Custom Question
            </Button>
          </div>

          {/* Empty State */}
          {fields.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
              <HelpCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Custom Questions Yet</h3>
              <p className="text-gray-500 mb-4">
                Add role-specific questions to better evaluate candidates beyond their resume.
              </p>
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  addQuestion()
                }}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Your First Question
              </Button>
            </div>
          )}

          {/* Summary */}
          {fields.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Questions Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Total Questions:</span>
                  <div className="font-semibold">{fields.length}</div>
                </div>
                <div>
                  <span className="text-red-700">Critical:</span>
                  <div className="font-semibold">
                    {watchedQuestions.filter(q => q.weight >= 8).length}
                  </div>
                </div>
                <div>
                  <span className="text-orange-700">Important:</span>
                  <div className="font-semibold">
                    {watchedQuestions.filter(q => q.weight >= 6 && q.weight < 8).length}
                  </div>
                </div>
                <div>
                  <span className="text-green-700">Valid:</span>
                  <div className="font-semibold">
                    {watchedQuestions.filter(q => validateQuestion(q.questionText).isValid).length}
                  </div>
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
                disabled={isSubmitting || isLoading || watchedQuestions.filter(q => validateQuestion(q.questionText).isValid).length === 0 && fields.length > 0}
                className="min-w-[120px]"
              >
                {isSubmitting ? "Saving..." : "Review & Create Role"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}