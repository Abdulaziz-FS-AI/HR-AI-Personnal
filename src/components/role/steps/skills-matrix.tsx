"use client"

import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, ArrowLeft, Target, Plus, Minus, Skip, Star } from "lucide-react"
import { skillsStepSchema, type SkillsStep, type Skill, skillCategories } from "@/lib/validations/role"

interface SkillsMatrixProps {
  initialSkills?: Skill[]
  onSubmit: (skills: Skill[]) => void
  onPrevious: () => void
  onSkip: () => void
  isLoading?: boolean
}

export function SkillsMatrix({ initialSkills = [], onSubmit, onPrevious, onSkip, isLoading }: SkillsMatrixProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<SkillsStep>({
    resolver: zodResolver(skillsStepSchema),
    defaultValues: {
      skills: initialSkills.length > 0 ? initialSkills : [
        { skillName: '', weight: 5, isRequired: false, category: 'Technical' }
      ]
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "skills"
  })

  const handleSubmit = async (data: SkillsStep) => {
    setIsSubmitting(true)
    try {
      // Filter out empty skills
      const validSkills = data.skills.filter(skill => skill.skillName.trim() !== '')
      onSubmit(validSkills)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addSkill = () => {
    append({ skillName: '', weight: 5, isRequired: false, category: 'Technical' })
  }

  const removeSkill = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }

  const getWeightLabel = (weight: number) => {
    if (weight >= 9) return "Critical"
    if (weight >= 7) return "Important" 
    if (weight >= 5) return "Moderate"
    if (weight >= 3) return "Nice to have"
    return "Optional"
  }

  const getWeightColor = (weight: number) => {
    if (weight >= 9) return "text-red-600"
    if (weight >= 7) return "text-orange-600"
    if (weight >= 5) return "text-blue-600"
    if (weight >= 3) return "text-green-600"
    return "text-gray-600"
  }

  const watchedSkills = form.watch("skills")
  const requiredSkillsCount = watchedSkills.filter(skill => skill.isRequired).length
  const totalSkillsCount = watchedSkills.filter(skill => skill.skillName.trim() !== '').length

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Target className="h-6 w-6 text-purple-600" />
          <CardTitle className="text-2xl font-bold">Skills Matrix</CardTitle>
          <Badge variant="secondary" className="ml-2">Optional</Badge>
        </div>
        <p className="text-muted-foreground">
          Step 3 of 5: Define required skills and their importance levels
        </p>
      </CardHeader>
      
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            
            {/* Skills Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  <h3 className="text-xl font-semibold">Skill Requirements</h3>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Total Skills: <Badge variant="outline">{totalSkillsCount}</Badge></span>
                  <span>Required: <Badge variant="default">{requiredSkillsCount}</Badge></span>
                </div>
              </div>

              {/* Skills List */}
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                      
                      {/* Skill Name */}
                      <div className="md:col-span-4">
                        <FormField
                          control={form.control}
                          name={`skills.${index}.skillName`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                Skill Name {index === 0 && <span className="text-red-500">*</span>}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., React, Python, SQL, Project Management"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Category */}
                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`skills.${index}.category`}
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
                                  {skillCategories.map((category) => (
                                    <SelectItem key={category} value={category}>
                                      {category}
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
                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`skills.${index}.weight`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">
                                Weight (1-10)
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

                      {/* Required */}
                      <div className="md:col-span-2 flex items-center space-x-2">
                        <FormField
                          control={form.control}
                          name={`skills.${index}.isRequired`}
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm">
                                  Required
                                </FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Actions */}
                      <div className="md:col-span-2 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeSkill(index)}
                          disabled={fields.length === 1}
                          className="h-10"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Weight Visual Indicator */}
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${
                            watchedSkills[index]?.weight >= 9 ? 'bg-red-500' :
                            watchedSkills[index]?.weight >= 7 ? 'bg-orange-500' :
                            watchedSkills[index]?.weight >= 5 ? 'bg-blue-500' :
                            watchedSkills[index]?.weight >= 3 ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                          style={{ width: `${(watchedSkills[index]?.weight || 1) * 10}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${getWeightColor(watchedSkills[index]?.weight || 1)}`}>
                        {getWeightLabel(watchedSkills[index]?.weight || 1)}
                      </span>
                      {watchedSkills[index]?.isRequired && (
                        <Badge variant="destructive" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Must Have
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Skill Button */}
              <Button
                type="button"
                variant="outline"
                onClick={addSkill}
                className="w-full h-12 border-dashed border-2 border-gray-300 hover:border-gray-400"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Skill
              </Button>
            </div>

            {/* Weight Guide */}
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h4 className="font-semibold text-purple-900 mb-3">Weight Scoring Guide</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span><strong>9-10:</strong> Critical</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded"></div>
                  <span><strong>7-8:</strong> Important</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span><strong>5-6:</strong> Moderate</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span><strong>3-4:</strong> Nice to have</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-400 rounded"></div>
                  <span><strong>1-2:</strong> Optional</span>
                </div>
              </div>
            </div>

            {/* Configuration Summary */}
            {totalSkillsCount > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">Skills Configuration Summary</h4>
                <p className="text-blue-800 text-sm">
                  You've defined {totalSkillsCount} skill{totalSkillsCount !== 1 ? 's' : ''} 
                  {requiredSkillsCount > 0 && ` with ${requiredSkillsCount} marked as required`}.
                  Our AI will evaluate candidates based on these skills and their importance weights.
                </p>
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
                  className="min-w-[120px] h-12"
                >
                  <Skip className="mr-2 h-4 w-4" />
                  Skip Step
                </Button>
                
                <Button
                  type="submit"
                  disabled={isLoading || isSubmitting}
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
                      Continue to Bonuses
                      <ArrowRight className="ml-2 h-4 w-4" />
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