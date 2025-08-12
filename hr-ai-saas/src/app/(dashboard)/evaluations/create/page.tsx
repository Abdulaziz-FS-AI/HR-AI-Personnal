"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  ArrowLeft,
  ArrowRight,
  Briefcase,
  GraduationCap,
  MapPin,
  Clock,
  FileText,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Users,
  Target,
  Loader2,
  ChevronRight,
  Building,
  FileUp
} from 'lucide-react'
import { FileDropzone } from '@/components/upload/FileDropzone'

interface Role {
  id: string
  title: string
  department?: string
  location?: string
  description?: string
  responsibilities?: string
  employmentType?: string
  seniorityLevel?: string
  minExperienceYears?: number
  maxExperienceYears?: number
  educationRequirements?: string
  createdAt: string
  skillsCount?: number
  questionsCount?: number
}

interface Skill {
  id: string
  skillName: string
  weight: number
  isRequired: boolean
  skillCategory?: string
}

interface Question {
  id: string
  questionText: string
  weight: number
  category?: string
}

interface UploadedFile {
  id: string
  name: string
  size: number
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  progress?: number
  error?: string
}

export default function CreateEvaluationPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingRoles, setIsLoadingRoles] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Data states
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [roleSkills, setRoleSkills] = useState<Skill[]>([])
  const [roleQuestions, setRoleQuestions] = useState<Question[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [evaluationName, setEvaluationName] = useState('')

  // Load roles on mount
  useEffect(() => {
    loadRoles()
  }, [])

  // Auto-generate evaluation name when role is selected
  useEffect(() => {
    if (selectedRole) {
      const date = new Date().toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
      setEvaluationName(`${selectedRole.title} - ${date} Evaluation`)
    }
  }, [selectedRole])

  const loadRoles = async () => {
    setIsLoadingRoles(true)
    try {
      const response = await fetch('/api/roles')
      if (!response.ok) throw new Error('Failed to load roles')
      
      const data = await response.json()
      setRoles(data.data || [])
    } catch (error) {
      console.error('Error loading roles:', error)
      toast.error('Failed to load roles')
    } finally {
      setIsLoadingRoles(false)
    }
  }

  const loadRoleDetails = async (roleId: string) => {
    setIsLoading(true)
    try {
      // Load skills
      const skillsResponse = await fetch(`/api/role-skills?roleId=${roleId}`)
      if (skillsResponse.ok) {
        const skillsData = await skillsResponse.json()
        setRoleSkills(skillsData.data || [])
      }

      // Load questions
      const questionsResponse = await fetch(`/api/role-questions?roleId=${roleId}`)
      if (questionsResponse.ok) {
        const questionsData = await questionsResponse.json()
        setRoleQuestions(questionsData.data || [])
      }
    } catch (error) {
      console.error('Error loading role details:', error)
      toast.error('Failed to load role details')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRoleSelect = async (role: Role) => {
    setSelectedRole(role)
    await loadRoleDetails(role.id)
  }

  const handleFilesSelected = (files: File[]) => {
    const newFiles: UploadedFile[] = files.map(file => ({
      id: `file-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      status: 'pending' as const
    }))
    
    setUploadedFiles(prev => [...prev, ...newFiles])
  }

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const startEvaluation = async () => {
    if (!selectedRole || uploadedFiles.length === 0) {
      toast.error('Please select a role and upload at least one file')
      return
    }

    setIsProcessing(true)
    
    try {
      // Upload files first
      for (const file of uploadedFiles) {
        setUploadedFiles(prev => 
          prev.map(f => f.id === file.id 
            ? { ...f, status: 'uploading' as const, progress: 0 }
            : f
          )
        )
        
        // Simulate file upload progress
        for (let i = 0; i <= 100; i += 20) {
          await new Promise(resolve => setTimeout(resolve, 200))
          setUploadedFiles(prev => 
            prev.map(f => f.id === file.id 
              ? { ...f, progress: i }
              : f
            )
          )
        }
        
        setUploadedFiles(prev => 
          prev.map(f => f.id === file.id 
            ? { ...f, status: 'completed' as const, progress: 100 }
            : f
          )
        )
      }

      // Create evaluation session
      const sessionData = {
        name: evaluationName,
        roleId: selectedRole.id,
        roleTitle: selectedRole.title,
        files: uploadedFiles.map(f => ({
          id: f.id,
          name: f.name,
          size: f.size
        }))
      }

      // Call API to create the evaluation
      const response = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create evaluation')
      }

      const result = await response.json()
      
      toast.success('Evaluation started successfully!')
      
      // Redirect to evaluations page
      router.push('/evaluations')
      
    } catch (error) {
      console.error('Error starting evaluation:', error)
      toast.error('Failed to start evaluation')
    } finally {
      setIsProcessing(false)
    }
  }

  const nextStep = () => {
    if (currentStep === 1 && !selectedRole) {
      toast.error('Please select a role to continue')
      return
    }
    setCurrentStep(2)
  }

  const previousStep = () => {
    setCurrentStep(1)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Evaluations
        </Button>
        
        <h1 className="text-3xl font-bold text-gray-900">Create New Evaluation</h1>
        <p className="text-gray-600 mt-1">
          Select a role and upload resumes to start AI-powered evaluation
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className={`flex items-center ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              currentStep >= 1 ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'
            }`}>
              {currentStep > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
            </div>
            <span className="ml-2 font-medium">Select Role</span>
          </div>
          
          <div className={`flex-1 h-1 mx-4 ${currentStep > 1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
          
          <div className={`flex items-center ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              currentStep >= 2 ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'
            }`}>
              2
            </div>
            <span className="ml-2 font-medium">Upload Resumes</span>
          </div>
        </div>
        <Progress value={currentStep * 50} className="h-2" />
      </div>

      {/* Step 1: Role Selection */}
      {currentStep === 1 && (
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Select Job Role</CardTitle>
              <p className="text-sm text-gray-600">
                Choose the role you want to evaluate candidates for
              </p>
            </CardHeader>
            <CardContent>
              {isLoadingRoles ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : roles.length === 0 ? (
                <div className="text-center py-12">
                  <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">No roles found</p>
                  <Button onClick={() => router.push('/roles/create')}>
                    Create Your First Role
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {roles.map((role) => (
                    <Card
                      key={role.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedRole?.id === role.id 
                          ? 'ring-2 ring-blue-600 bg-blue-50' 
                          : ''
                      }`}
                      onClick={() => handleRoleSelect(role)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{role.title}</h3>
                            {role.department && (
                              <p className="text-sm text-gray-600 mt-1">
                                <Building className="w-3 h-3 inline mr-1" />
                                {role.department}
                              </p>
                            )}
                            {role.location && (
                              <p className="text-sm text-gray-600">
                                <MapPin className="w-3 h-3 inline mr-1" />
                                {role.location}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              {role.skillsCount !== undefined && (
                                <span>
                                  <Target className="w-3 h-3 inline mr-1" />
                                  {role.skillsCount} skills
                                </span>
                              )}
                              {role.questionsCount !== undefined && (
                                <span>
                                  <FileText className="w-3 h-3 inline mr-1" />
                                  {role.questionsCount} questions
                                </span>
                              )}
                            </div>
                          </div>
                          {selectedRole?.id === role.id && (
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              
              <div className="flex justify-end mt-6">
                <Button
                  onClick={nextStep}
                  disabled={!selectedRole}
                  className="min-w-[120px]"
                >
                  Next Step
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 2: Upload Resumes */}
      {currentStep === 2 && selectedRole && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Upload Area */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Step 2: Upload Resumes</CardTitle>
                <p className="text-sm text-gray-600">
                  Upload candidate resumes for evaluation (PDF files, max 10MB each)
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Evaluation Name */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">
                      Evaluation Name
                    </label>
                    <input
                      type="text"
                      value={evaluationName}
                      onChange={(e) => setEvaluationName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter evaluation name"
                    />
                  </div>

                  {/* File Upload */}
                  <div>
                    <FileDropzone
                      onFilesSelected={handleFilesSelected}
                      maxFiles={150}
                      maxSize={10 * 1024 * 1024}
                      accept={{ 'application/pdf': ['.pdf'] }}
                    />
                  </div>

                  {/* Uploaded Files List */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-gray-700">
                        Uploaded Files ({uploadedFiles.length})
                      </h4>
                      <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3">
                        {uploadedFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100"
                          >
                            <div className="flex items-center space-x-3">
                              <FileText className="w-4 h-4 text-gray-500" />
                              <div>
                                <p className="text-sm font-medium truncate max-w-xs">
                                  {file.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {file.status === 'uploading' && (
                                <div className="flex items-center space-x-2">
                                  <div className="w-24 bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-blue-600 h-2 rounded-full transition-all"
                                      style={{ width: `${file.progress}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {file.progress}%
                                  </span>
                                </div>
                              )}
                              {file.status === 'completed' && (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              )}
                              {file.status === 'failed' && (
                                <AlertCircle className="w-4 h-4 text-red-600" />
                              )}
                              {file.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFile(file.id)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-between pt-4">
                    <Button
                      variant="outline"
                      onClick={previousStep}
                      disabled={isProcessing}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Previous
                    </Button>
                    
                    <Button
                      onClick={startEvaluation}
                      disabled={uploadedFiles.length === 0 || isProcessing}
                      className="min-w-[140px]"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Start Evaluation
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Role Details Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Selected Role</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedRole.title}</h3>
                  {selectedRole.department && (
                    <p className="text-sm text-gray-600 mt-1">
                      <Building className="w-3 h-3 inline mr-1" />
                      {selectedRole.department}
                    </p>
                  )}
                  {selectedRole.location && (
                    <p className="text-sm text-gray-600">
                      <MapPin className="w-3 h-3 inline mr-1" />
                      {selectedRole.location}
                    </p>
                  )}
                </div>

                {selectedRole.description && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-1">Description</h4>
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {selectedRole.description}
                    </p>
                  </div>
                )}

                {(selectedRole.minExperienceYears || selectedRole.maxExperienceYears) && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-1">Experience</h4>
                    <p className="text-sm text-gray-600">
                      {selectedRole.minExperienceYears || 0} - {selectedRole.maxExperienceYears || '∞'} years
                    </p>
                  </div>
                )}

                {selectedRole.educationRequirements && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-1">
                      <GraduationCap className="w-3 h-3 inline mr-1" />
                      Education
                    </h4>
                    <p className="text-sm text-gray-600">
                      {selectedRole.educationRequirements}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Skills */}
            {roleSkills.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Required Skills ({roleSkills.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {roleSkills.slice(0, 5).map((skill) => (
                      <div key={skill.id} className="flex items-center justify-between">
                        <span className="text-sm">{skill.skillName}</span>
                        <div className="flex items-center space-x-2">
                          <Badge variant={skill.isRequired ? "default" : "secondary"} className="text-xs">
                            {skill.weight}/10
                          </Badge>
                          {skill.isRequired && (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {roleSkills.length > 5 && (
                      <p className="text-xs text-gray-500 pt-2">
                        +{roleSkills.length - 5} more skills
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Questions */}
            {roleQuestions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Evaluation Questions ({roleQuestions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {roleQuestions.slice(0, 3).map((question, index) => (
                      <p key={question.id} className="text-sm text-gray-600">
                        {index + 1}. {question.questionText}
                      </p>
                    ))}
                    {roleQuestions.length > 3 && (
                      <p className="text-xs text-gray-500 pt-2">
                        +{roleQuestions.length - 3} more questions
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}