"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { 
  ArrowLeft, 
  ArrowRight, 
  Briefcase, 
  FileText, 
  Zap, 
  CheckCircle,
  Info
} from 'lucide-react'
import Link from 'next/link'

interface Role {
  id: string
  title: string
  department: string | null
  location: string | null
  seniorityLevel: string | null
}

export default function CreateEvaluationPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()
  
  const [step, setStep] = useState(1)
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  
  // Form data
  const [evaluationData, setEvaluationData] = useState({
    name: '',
    description: '',
    roleId: '',
    files: [] as File[]
  })
  
  // Fetch available roles
  useEffect(() => {
    if (session?.user?.id) {
      fetchRoles()
    }
  }, [session])
  
  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/roles')
      if (response.ok) {
        const data = await response.json()
        setRoles(data.roles || [])
      }
    } catch (error) {
      console.error('Error fetching roles:', error)
      toast({
        title: "Error",
        description: "Failed to load roles",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  
  const handleNext = () => {
    // Validate current step
    if (step === 1) {
      if (!evaluationData.name || !evaluationData.roleId) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive"
        })
        return
      }
    }
    
    if (step < 3) {
      setStep(step + 1)
    }
  }
  
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }
  
  const handleCreateEvaluation = async () => {
    if (!session?.user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to create an evaluation",
        variant: "destructive"
      })
      return
    }
    
    try {
      // Step 1: Create evaluation session
      const createResponse = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: evaluationData.name,
          description: evaluationData.description,
          roleId: evaluationData.roleId,
          userId: session.user.id
        })
      })
      
      if (!createResponse.ok) {
        throw new Error('Failed to create evaluation')
      }
      
      const { evaluation } = await createResponse.json()
      
      toast({
        title: "Success",
        description: "Evaluation created successfully! Redirecting to file upload...",
      })
      
      // Redirect to file upload page for this evaluation
      setTimeout(() => {
        router.push(`/evaluations/${evaluation.id}/upload`)
      }, 1500)
      
    } catch (error) {
      console.error('Error creating evaluation:', error)
      toast({
        title: "Error",
        description: "Failed to create evaluation",
        variant: "destructive"
      })
    }
  }
  
  const selectedRole = roles.find(r => r.id === evaluationData.roleId)
  
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/evaluations">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Evaluations
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Evaluation</h1>
            <p className="text-gray-600 mt-1">
              Set up a new evaluation session for candidate screening
            </p>
          </div>
        </div>
      </div>
      
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
              step >= 1 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'
            }`}>
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="ml-3 font-medium">Evaluation Details</span>
          </div>
          
          <div className={`flex-1 h-0.5 mx-4 ${step > 1 ? 'bg-blue-600' : 'bg-gray-300'}`} />
          
          <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
              step >= 2 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'
            }`}>
              <FileText className="w-5 h-5" />
            </div>
            <span className="ml-3 font-medium">Review & Confirm</span>
          </div>
          
          <div className={`flex-1 h-0.5 mx-4 ${step > 2 ? 'bg-blue-600' : 'bg-gray-300'}`} />
          
          <div className={`flex items-center ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
              step >= 3 ? 'border-blue-600 bg-blue-50' : 'border-gray-300'
            }`}>
              <CheckCircle className="w-5 h-5" />
            </div>
            <span className="ml-3 font-medium">Upload Files</span>
          </div>
        </div>
      </div>
      
      {/* Step Content */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Evaluation Details</CardTitle>
            <CardDescription>
              Configure the basic information for your evaluation session
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Evaluation Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Q1 2024 Frontend Developer Screening"
                value={evaluationData.name}
                onChange={(e) => setEvaluationData({ ...evaluationData, name: e.target.value })}
              />
              <p className="text-sm text-gray-500">
                Give your evaluation a descriptive name for easy identification
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe the purpose of this evaluation..."
                value={evaluationData.description}
                onChange={(e) => setEvaluationData({ ...evaluationData, description: e.target.value })}
                rows={4}
              />
              <p className="text-sm text-gray-500">
                Add any additional context or notes about this evaluation
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Select Role *</Label>
              <Select
                value={evaluationData.roleId}
                onValueChange={(value) => setEvaluationData({ ...evaluationData, roleId: value })}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Choose a role to evaluate against" />
                </SelectTrigger>
                <SelectContent>
                  {loading ? (
                    <SelectItem value="loading" disabled>Loading roles...</SelectItem>
                  ) : roles.length === 0 ? (
                    <SelectItem value="none" disabled>No roles available</SelectItem>
                  ) : (
                    roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        <div>
                          <div className="font-medium">{role.title}</div>
                          {(role.department || role.location) && (
                            <div className="text-sm text-gray-500">
                              {[role.department, role.location].filter(Boolean).join(' • ')}
                            </div>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                Candidates will be evaluated based on this role's requirements
              </p>
            </div>
            
            {roles.length === 0 && !loading && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Info className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="ml-3">
                    <p className="text-sm text-yellow-800">
                      You need to create at least one role before starting an evaluation.
                    </p>
                    <Button variant="link" className="p-0 h-auto mt-1" asChild>
                      <Link href="/roles/create">Create your first role →</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Confirm</CardTitle>
            <CardDescription>
              Review your evaluation settings before proceeding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Evaluation Name</p>
                <p className="font-medium">{evaluationData.name}</p>
              </div>
              
              {evaluationData.description && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Description</p>
                  <p className="text-gray-900">{evaluationData.description}</p>
                </div>
              )}
              
              <div>
                <p className="text-sm text-gray-600 mb-1">Selected Role</p>
                <div className="font-medium">
                  {selectedRole?.title}
                  {selectedRole && (selectedRole.department || selectedRole.location) && (
                    <span className="text-sm text-gray-500 ml-2">
                      ({[selectedRole.department, selectedRole.location].filter(Boolean).join(' • ')})
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <Zap className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="ml-3">
                  <p className="text-sm text-blue-900 font-medium">Next Step: Upload Resumes</p>
                  <p className="text-sm text-blue-800 mt-1">
                    After creating this evaluation, you'll be redirected to upload candidate resumes.
                    You can upload up to 150 PDF files for batch processing.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600">
                By creating this evaluation, you confirm that:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                <li>• The selected role has all required skills and questions configured</li>
                <li>• You have the necessary permissions to evaluate candidates</li>
                <li>• You understand the AI will analyze resumes based on the role criteria</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
      
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Creating Evaluation...</CardTitle>
            <CardDescription>
              Please wait while we set up your evaluation session
            </CardDescription>
          </CardHeader>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Evaluation Created!</h3>
              <p className="text-gray-600">
                Redirecting you to upload resumes...
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Navigation Buttons */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 1}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        {step < 2 ? (
          <Button
            onClick={handleNext}
            disabled={!evaluationData.name || !evaluationData.roleId}
          >
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : step === 2 ? (
          <Button
            onClick={() => {
              setStep(3)
              handleCreateEvaluation()
            }}
          >
            Create Evaluation
            <CheckCircle className="w-4 h-4 ml-2" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}