"use client"

import Link from "next/link"
import { ArrowLeft, Upload, Users, Star, Calendar, MapPin, Building, GraduationCap } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { type Role, type RoleSkill, type RoleQuestion } from "@/lib/db"

interface RoleDetailProps {
  role: Role
  skills: RoleSkill[]
  questions: RoleQuestion[]
}

export function RoleDetail({ role, skills, questions }: RoleDetailProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date))
  }

  const getEmploymentTypeColor = (type: string | null) => {
    switch (type) {
      case 'full-time': return 'bg-blue-100 text-blue-800'
      case 'part-time': return 'bg-green-100 text-green-800'
      case 'contract': return 'bg-orange-100 text-orange-800'
      case 'freelance': return 'bg-purple-100 text-purple-800'
      case 'internship': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeniorityColor = (level: string | null) => {
    switch (level) {
      case 'entry': return 'bg-green-100 text-green-800'
      case 'junior': return 'bg-blue-100 text-blue-800'
      case 'mid': return 'bg-orange-100 text-orange-800'
      case 'senior': return 'bg-purple-100 text-purple-800'
      case 'lead': return 'bg-red-100 text-red-800'
      case 'executive': return 'bg-gray-900 text-white'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getWeightColor = (weight: number) => {
    if (weight >= 9) return "text-red-600 bg-red-50"
    if (weight >= 7) return "text-orange-600 bg-orange-50"
    if (weight >= 5) return "text-yellow-600 bg-yellow-50"
    return "text-green-600 bg-green-50"
  }

  const getWeightLabel = (weight: number) => {
    if (weight >= 9) return "Must-Have"
    if (weight >= 7) return "Important"
    if (weight >= 5) return "Preferred"
    return "Nice-to-Have"
  }

  const skillsByCategory = skills.reduce((acc, skill) => {
    const category = skill.skillCategory || 'Other'
    if (!acc[category]) acc[category] = []
    acc[category].push(skill)
    return acc
  }, {} as Record<string, RoleSkill[]>)

  const questionsByCategory = questions.reduce((acc, question) => {
    const category = question.category || 'Other'
    if (!acc[category]) acc[category] = []
    acc[category].push(question)
    return acc
  }, {} as Record<string, RoleQuestion[]>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/roles">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Roles
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{role.title}</h1>
            <p className="text-gray-600">Created {formatDate(role.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href={`/dashboard/roles/${role.id}/screen`}>
            <Button className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Screen Resumes
            </Button>
          </Link>
        </div>
      </div>

      {/* Role Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Role Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Basic Info */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Basic Information</h4>
              <div className="space-y-2">
                {role.department && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="w-4 h-4 text-gray-400" />
                    <span>{role.department}</span>
                  </div>
                )}
                {role.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{role.location}</span>
                  </div>
                )}
                {role.employmentType && (
                  <Badge className={getEmploymentTypeColor(role.employmentType)}>
                    {role.employmentType.replace('-', ' ')}
                  </Badge>
                )}
                {role.seniorityLevel && (
                  <Badge className={getSeniorityColor(role.seniorityLevel)}>
                    {role.seniorityLevel}
                  </Badge>
                )}
              </div>
            </div>

            {/* Experience */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Experience Required</h4>
              <div className="text-2xl font-bold text-blue-600">
                {role.minExperienceYears || 0}-{role.maxExperienceYears || '∞'} years
              </div>
            </div>

            {/* Skills Count */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Skills Defined</h4>
              <div className="text-2xl font-bold text-green-600">
                {skills.length}
              </div>
              <div className="text-sm text-gray-500">
                {skills.filter(s => s.isRequired).length} required
              </div>
            </div>

            {/* Questions Count */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Custom Questions</h4>
              <div className="text-2xl font-bold text-purple-600">
                {questions.length}
              </div>
              <div className="text-sm text-gray-500">
                Evaluation questions
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description and Responsibilities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {role.description && (
          <Card>
            <CardHeader>
              <CardTitle>Job Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">{role.description}</p>
            </CardContent>
          </Card>
        )}

        {role.responsibilities && (
          <Card>
            <CardHeader>
              <CardTitle>Key Responsibilities</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">{role.responsibilities}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Education Requirements */}
      {role.educationRequirements && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Education Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{role.educationRequirements}</p>
          </CardContent>
        </Card>
      )}

      {/* Skills Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Skills & Requirements ({skills.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {skills.length > 0 ? (
            <div className="space-y-6">
              {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                <div key={category}>
                  <h4 className="font-semibold text-gray-900 mb-3">{category}</h4>
                  <div className="space-y-2">
                    {categorySkills
                      .sort((a, b) => b.weight - a.weight)
                      .map((skill) => (
                        <div key={skill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{skill.skillName}</span>
                            {skill.isRequired && (
                              <Badge variant="destructive" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={`px-2 py-1 rounded text-xs font-medium ${getWeightColor(skill.weight)}`}>
                              {skill.weight}/10 - {getWeightLabel(skill.weight)}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No skills defined for this role.</p>
          )}
        </CardContent>
      </Card>

      {/* Custom Questions */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Questions ({questions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {questions.length > 0 ? (
            <div className="space-y-6">
              {Object.entries(questionsByCategory).map(([category, categoryQuestions]) => (
                <div key={category}>
                  <h4 className="font-semibold text-gray-900 mb-3">{category}</h4>
                  <div className="space-y-3">
                    {categoryQuestions
                      .sort((a, b) => b.weight - a.weight)
                      .map((question, index) => (
                        <div key={question.id} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 mb-2">
                                Question {index + 1}
                              </p>
                              <p className="text-gray-700">{question.questionText}</p>
                            </div>
                            <div className={`ml-4 px-2 py-1 rounded text-xs font-medium ${getWeightColor(question.weight)}`}>
                              {question.weight}/10
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No custom questions defined for this role.</p>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Role Metadata
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Created:</span>
              <div className="font-medium">{formatDate(role.createdAt)}</div>
            </div>
            <div>
              <span className="text-gray-500">Last Updated:</span>
              <div className="font-medium">{formatDate(role.updatedAt)}</div>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <div className="font-medium">
                <Badge variant={role.isActive ? "default" : "secondary"}>
                  {role.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-gray-500">Role ID:</span>
              <div className="font-mono text-xs">{role.id}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}