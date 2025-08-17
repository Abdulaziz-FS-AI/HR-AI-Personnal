"use client"

import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowRight, ArrowLeft, Star, AlertTriangle, Plus, Minus, SkipForward, X } from "lucide-react"
import { bonusPenaltyStepSchema, type BonusPenaltyStep, universityCategories, companyCategories, jobHoppingSensitivity, employmentGapThresholds } from "@/lib/validations/role"

interface BonusPenaltyConfigProps {
  initialData?: BonusPenaltyStep
  onSubmit: (data: BonusPenaltyStep) => void
  onNext: () => void
  onPrevious: () => void
  onSkip: () => void
  onExit?: () => void
  isLoading?: boolean
}

export function BonusPenaltyConfig({ initialData, onSubmit, onNext, onPrevious, onSkip, onExit, isLoading }: BonusPenaltyConfigProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showExitDialog, setShowExitDialog] = useState(false)

  const form = useForm<BonusPenaltyStep>({
    resolver: zodResolver(bonusPenaltyStepSchema),
    defaultValues: {
      bonusConfig: {
        preferredEducation: {
          enabled: initialData?.bonusConfig?.preferredEducation?.enabled || false,
          specificUniversities: initialData?.bonusConfig?.preferredEducation?.specificUniversities || [],
          universityCategories: initialData?.bonusConfig?.preferredEducation?.universityCategories || []
        },
        preferredCompanies: {
          enabled: initialData?.bonusConfig?.preferredCompanies?.enabled || false,
          specificCompanies: initialData?.bonusConfig?.preferredCompanies?.specificCompanies || [],
          companyCategories: initialData?.bonusConfig?.preferredCompanies?.companyCategories || []
        },
        relatedProjects: {
          enabled: initialData?.bonusConfig?.relatedProjects?.enabled || false,
          description: initialData?.bonusConfig?.relatedProjects?.description || ''
        },
        relatedCertifications: {
          enabled: initialData?.bonusConfig?.relatedCertifications?.enabled || false,
          certificationsList: initialData?.bonusConfig?.relatedCertifications?.certificationsList || []
        }
      },
      penaltyConfig: {
        jobHopping: {
          enabled: initialData?.penaltyConfig?.jobHopping?.enabled || false,
          sensitivity: initialData?.penaltyConfig?.jobHopping?.sensitivity || 'moderate'
        },
        employmentGaps: {
          enabled: initialData?.penaltyConfig?.employmentGaps?.enabled || false,
          threshold: initialData?.penaltyConfig?.employmentGaps?.threshold || '1year'
        }
      }
    }
  })

  const { fields: universityFields, append: addUniversity, remove: removeUniversity } = useFieldArray({
    control: form.control,
    name: "bonusConfig.preferredEducation.specificUniversities"
  })

  const { fields: companyFields, append: addCompany, remove: removeCompany } = useFieldArray({
    control: form.control,
    name: "bonusConfig.preferredCompanies.specificCompanies"
  })

  const { fields: certFields, append: addCert, remove: removeCert } = useFieldArray({
    control: form.control,
    name: "bonusConfig.relatedCertifications.certificationsList"
  })

  const handleSubmit = async (data: BonusPenaltyStep) => {
    setIsSubmitting(true)
    try {
      onSubmit(data)
      onNext() // Navigate to next step after successful submission
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExit = () => {
    if (onExit) {
      onExit()
    } else {
      // Fallback to skip if no exit handler provided
      onSkip()
    }
    setShowExitDialog(false)
  }

  const watchBonusEducation = form.watch("bonusConfig.preferredEducation.enabled")
  const watchBonusCompanies = form.watch("bonusConfig.preferredCompanies.enabled")
  const watchBonusProjects = form.watch("bonusConfig.relatedProjects.enabled")
  const watchBonusCerts = form.watch("bonusConfig.relatedCertifications.enabled")
  const watchPenaltyJobHopping = form.watch("penaltyConfig.jobHopping.enabled")
  const watchPenaltyGaps = form.watch("penaltyConfig.employmentGaps.enabled")

  const hasAnyConfiguration = watchBonusEducation || watchBonusCompanies || watchBonusProjects || watchBonusCerts || watchPenaltyJobHopping || watchPenaltyGaps

  // Check for form errors
  const formErrors = form.formState.errors
  const hasErrors = Object.keys(formErrors).length > 0

  return (
    <>
      <Card className="w-full max-w-6xl mx-auto">
        <CardHeader className="text-center relative">
          {/* Exit Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExitDialog(true)}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4 mr-1" />
            Exit
          </Button>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            <Star className="h-6 w-6 text-yellow-600" />
            <CardTitle className="text-2xl font-bold">Evaluation Enhancements</CardTitle>
            <Badge variant="secondary" className="ml-2">Optional</Badge>
          </div>
          <p className="text-muted-foreground">
            Step 4 of 6: Configure bonus points and risk factors (Advanced AI Scoring)
          </p>
        
        {/* Error Summary */}
        {hasErrors && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
              <AlertTriangle className="h-4 w-4" />
              Please complete the following:
            </div>
            <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
              {formErrors.bonusConfig?.preferredEducation && (
                <li>{formErrors.bonusConfig.preferredEducation.message}</li>
              )}
              {formErrors.bonusConfig?.preferredCompanies && (
                <li>{formErrors.bonusConfig.preferredCompanies.message}</li>
              )}
              {formErrors.bonusConfig?.relatedProjects && (
                <li>{formErrors.bonusConfig.relatedProjects.message}</li>
              )}
              {formErrors.bonusConfig?.relatedCertifications && (
                <li>{formErrors.bonusConfig.relatedCertifications.message}</li>
              )}
              {formErrors.penaltyConfig?.jobHopping && (
                <li>{formErrors.penaltyConfig.jobHopping.message}</li>
              )}
              {formErrors.penaltyConfig?.employmentGaps && (
                <li>{formErrors.penaltyConfig.employmentGaps.message}</li>
              )}
            </ul>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            
            {/* Bonus Configuration */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-600" />
                <h3 className="text-xl font-semibold">Quality Bonuses</h3>
                <p className="text-sm text-gray-500">Award extra points for excellence indicators</p>
              </div>

              {/* Preferred Education */}
              <div className={`border rounded-lg p-4 space-y-4 ${
                watchBonusEducation && formErrors.bonusConfig?.preferredEducation 
                  ? 'border-red-300 bg-red-50' 
                  : watchBonusEducation 
                  ? 'border-blue-300 bg-blue-50' 
                  : 'border-gray-200'
              }`}>
                <FormField
                  control={form.control}
                  name="bonusConfig.preferredEducation.enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-base font-semibold">
                          Preferred Education
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Bonus points for candidates from preferred universities or categories
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {watchBonusEducation && (
                  <div className="ml-6 space-y-4 border-l-2 border-gray-200 pl-4">
                    {/* Specific Universities */}
                    <div>
                      <FormLabel className="text-sm font-medium">Specific Universities</FormLabel>
                      <div className="space-y-2 mt-2">
                        {universityFields.map((field, index) => (
                          <div key={field.id} className="flex gap-2">
                            <Input
                              placeholder="e.g., MIT, Stanford, Harvard"
                              {...form.register(`bonusConfig.preferredEducation.specificUniversities.${index}` as const)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeUniversity(index)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addUniversity("")}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add University
                        </Button>
                      </div>
                    </div>

                    {/* University Categories */}
                    <div>
                      <FormLabel className="text-sm font-medium">OR Select Categories</FormLabel>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {universityCategories.map((category) => (
                          <FormField
                            key={category}
                            control={form.control}
                            name="bonusConfig.preferredEducation.universityCategories"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(category)}
                                    onCheckedChange={(checked) => {
                                      const currentValue = field.value || []
                                      if (checked) {
                                        field.onChange([...currentValue, category])
                                      } else {
                                        field.onChange(currentValue.filter((item) => item !== category))
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  {category}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Preferred Companies */}
              <div className={`border rounded-lg p-4 space-y-4 ${
                watchBonusCompanies && formErrors.bonusConfig?.preferredCompanies 
                  ? 'border-red-300 bg-red-50' 
                  : watchBonusCompanies 
                  ? 'border-blue-300 bg-blue-50' 
                  : 'border-gray-200'
              }`}>
                <FormField
                  control={form.control}
                  name="bonusConfig.preferredCompanies.enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-base font-semibold">
                          Preferred Company Experience
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Bonus points for candidates with experience at target companies
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {watchBonusCompanies && (
                  <div className="ml-6 space-y-4 border-l-2 border-gray-200 pl-4">
                    {/* Specific Companies */}
                    <div>
                      <FormLabel className="text-sm font-medium">Specific Companies</FormLabel>
                      <div className="space-y-2 mt-2">
                        {companyFields.map((field, index) => (
                          <div key={field.id} className="flex gap-2">
                            <Input
                              placeholder="e.g., Google, Apple, Microsoft"
                              {...form.register(`bonusConfig.preferredCompanies.specificCompanies.${index}` as const)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeCompany(index)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addCompany("")}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Company
                        </Button>
                      </div>
                    </div>

                    {/* Company Categories */}
                    <div>
                      <FormLabel className="text-sm font-medium">OR Select Categories</FormLabel>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {companyCategories.map((category) => (
                          <FormField
                            key={category}
                            control={form.control}
                            name="bonusConfig.preferredCompanies.companyCategories"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(category)}
                                    onCheckedChange={(checked) => {
                                      const currentValue = field.value || []
                                      if (checked) {
                                        field.onChange([...currentValue, category])
                                      } else {
                                        field.onChange(currentValue.filter((item) => item !== category))
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  {category}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Related Projects */}
              <div className={`border rounded-lg p-4 space-y-4 ${
                watchBonusProjects && formErrors.bonusConfig?.relatedProjects 
                  ? 'border-red-300 bg-red-50' 
                  : watchBonusProjects 
                  ? 'border-blue-300 bg-blue-50' 
                  : 'border-gray-200'
              }`}>
                <FormField
                  control={form.control}
                  name="bonusConfig.relatedProjects.enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-base font-semibold">
                          Related Project Experience
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Evaluate project relevance on a 1-10 scale
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {watchBonusProjects && (
                  <div className="ml-6 border-l-2 border-gray-200 pl-4">
                    <FormField
                      control={form.control}
                      name="bonusConfig.relatedProjects.description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Describe ideal project experience:</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="e.g., Built distributed systems handling millions of requests. Led migration to microservices. Implemented ML models in production."
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Valuable Certifications */}
              <div className={`border rounded-lg p-4 space-y-4 ${
                watchBonusCerts && formErrors.bonusConfig?.relatedCertifications 
                  ? 'border-red-300 bg-red-50' 
                  : watchBonusCerts 
                  ? 'border-blue-300 bg-blue-50' 
                  : 'border-gray-200'
              }`}>
                <FormField
                  control={form.control}
                  name="bonusConfig.relatedCertifications.enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-base font-semibold">
                          Valuable Certifications
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Evaluate certification relevance on a 1-10 scale
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {watchBonusCerts && (
                  <div className="ml-6 space-y-2 border-l-2 border-gray-200 pl-4">
                    {certFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <Input
                          placeholder="e.g., AWS Solutions Architect, PMP, CISSP"
                          {...form.register(`bonusConfig.relatedCertifications.certificationsList.${index}` as const)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeCert(index)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addCert("")}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Certification
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Penalty Configuration */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h3 className="text-xl font-semibold">Risk Penalties</h3>
                <p className="text-sm text-gray-500">Deduct points for potential concerns</p>
              </div>

              {/* Job Stability Check */}
              <div className={`border rounded-lg p-4 space-y-4 ${
                watchPenaltyJobHopping && formErrors.penaltyConfig?.jobHopping 
                  ? 'border-red-300 bg-red-50' 
                  : watchPenaltyJobHopping 
                  ? 'border-orange-300 bg-orange-50' 
                  : 'border-red-200'
              }`}>
                <FormField
                  control={form.control}
                  name="penaltyConfig.jobHopping.enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-base font-semibold">
                          Job Stability Check
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Assess employment stability and retention risk
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {watchPenaltyJobHopping && (
                  <div className="ml-6 border-l-2 border-red-200 pl-4">
                    <FormField
                      control={form.control}
                      name="penaltyConfig.jobHopping.sensitivity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>How concerned about job hopping?</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select sensitivity level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {jobHoppingSensitivity.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Employment Gap Check */}
              <div className={`border rounded-lg p-4 space-y-4 ${
                watchPenaltyGaps && formErrors.penaltyConfig?.employmentGaps 
                  ? 'border-red-300 bg-red-50' 
                  : watchPenaltyGaps 
                  ? 'border-orange-300 bg-orange-50' 
                  : 'border-red-200'
              }`}>
                <FormField
                  control={form.control}
                  name="penaltyConfig.employmentGaps.enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-base font-semibold">
                          Employment Gap Check
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Flag unexplained career gaps
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {watchPenaltyGaps && (
                  <div className="ml-6 border-l-2 border-red-200 pl-4">
                    <FormField
                      control={form.control}
                      name="penaltyConfig.employmentGaps.threshold"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gaps longer than:</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select threshold" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {employmentGapThresholds.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Configuration Summary */}
            {hasAnyConfiguration && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">Configuration Summary</h4>
                <p className="text-blue-800 text-sm">
                  You've enabled advanced AI scoring with sophisticated bonus/penalty calculations. 
                  This will provide more nuanced and accurate candidate evaluations beyond basic requirements matching.
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
                  <SkipForward className="mr-2 h-4 w-4" />
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
                      Continue to Questions
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

    {/* Exit Confirmation Dialog */}
    <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure you want to exit?</DialogTitle>
          <DialogDescription>
            Any unsaved changes in this step will be lost. You can always return to configure bonus and penalty settings later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setShowExitDialog(false)}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleExit}
          >
            Exit Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}