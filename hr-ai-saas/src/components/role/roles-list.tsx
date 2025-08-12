"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Plus, Edit, Trash2, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { type createRoleSchema } from "@/lib/validations/role"
import { z } from "zod"

type Role = z.infer<typeof createRoleSchema> & {
  id: string
  userId: string
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

interface RolesListProps {
  initialRoles: Role[]
}

export function RolesList({ initialRoles }: RolesListProps) {
  const [roles, setRoles] = useState<Role[]>(initialRoles)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Are you sure you want to delete this role? This action cannot be undone.")) {
      return
    }

    setIsDeleting(roleId)
    try {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete role')
      }

      setRoles(prev => prev.filter(role => role.id !== roleId))
      toast.success("Role deleted successfully")
    } catch (error) {
      console.error('Error deleting role:', error)
      toast.error("Failed to delete role")
    } finally {
      setIsDeleting(null)
    }
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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

  if (roles.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <Users className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Job Roles Yet</h3>
          <p className="text-gray-500 text-center mb-6 max-w-md">
            Create your first job role to start screening candidates with AI-powered analysis.
            Define skills, requirements, and custom questions for better candidate matching.
          </p>
          <Link href="/roles/create">
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Your First Role
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Your Job Roles ({roles.length})</h2>
        </div>
        <Link href="/roles/create">
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create New Role
          </Button>
        </Link>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((role) => (
          <Card key={role.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg font-semibold line-clamp-2 mb-2">
                    {role.title}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {role.employmentType && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEmploymentTypeColor(role.employmentType)}`}>
                        {role.employmentType.replace('-', ' ')}
                      </span>
                    )}
                    {role.seniorityLevel && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeniorityColor(role.seniorityLevel)}`}>
                        {role.seniorityLevel}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Link href={`/roles/${role.id}/edit`}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteRole(role.id)}
                    disabled={isDeleting === role.id}
                  >
                    {isDeleting === role.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {/* Role Details */}
              <div className="space-y-3">
                {role.description && (
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {role.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {role.department && (
                    <div>
                      <span className="text-gray-500">Department:</span>
                      <div className="font-medium">{role.department}</div>
                    </div>
                  )}
                  
                  {role.location && (
                    <div>
                      <span className="text-gray-500">Location:</span>
                      <div className="font-medium">{role.location}</div>
                    </div>
                  )}

                  {(role.minExperienceYears !== null || role.maxExperienceYears !== null) && (
                    <div>
                      <span className="text-gray-500">Experience:</span>
                      <div className="font-medium">
                        {role.minExperienceYears || 0}-{role.maxExperienceYears || '∞'} years
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-gray-500">Created:</span>
                    <div className="font-medium">{formatDate(role.createdAt)}</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-3 border-t">
                  <Link href={`/roles/${role.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      View Details
                    </Button>
                  </Link>
                  <Link href={`/roles/${role.id}/screen`} className="flex-1">
                    <Button size="sm" className="w-full">
                      Screen Resumes
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{roles.length}</div>
              <div className="text-sm text-gray-500">Total Roles</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {roles.filter(r => r.employmentType === 'full-time').length}
              </div>
              <div className="text-sm text-gray-500">Full-time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {roles.filter(r => r.seniorityLevel === 'senior').length}
              </div>
              <div className="text-sm text-gray-500">Senior Level</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {roles.filter(r => new Date(r.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
              </div>
              <div className="text-sm text-gray-500">Created This Week</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}