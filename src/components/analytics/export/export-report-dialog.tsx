"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  Image, 
  Mail,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  BarChart3,
  Brain,
  Settings
} from "lucide-react"

interface ExportReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  evaluationId: string
  analyticsData: any
}

interface ExportOptions {
  format: "PDF" | "EXCEL" | "CSV" | "JSON"
  sections: {
    executiveSummary: boolean
    scoreDistribution: boolean
    skillsAnalysis: boolean
    candidateComparison: boolean
    aiInsights: boolean
    recommendations: boolean
    charts: boolean
  }
  audience: "EXECUTIVE" | "HR_MANAGER" | "TECHNICAL" | "DETAILED"
  customization: {
    includeRawData: boolean
    includeCandidateNames: boolean
    includeConfidentialInfo: boolean
    brandLogo: boolean
  }
  delivery: {
    method: "DOWNLOAD" | "EMAIL" | "SCHEDULED"
    email?: string
    scheduledTime?: string
  }
}

export function ExportReportDialog({ open, onOpenChange, evaluationId, analyticsData }: ExportReportDialogProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: "PDF",
    sections: {
      executiveSummary: true,
      scoreDistribution: true,
      skillsAnalysis: true,
      candidateComparison: true,
      aiInsights: true,
      recommendations: true,
      charts: true
    },
    audience: "HR_MANAGER",
    customization: {
      includeRawData: false,
      includeCandidateNames: true,
      includeConfidentialInfo: false,
      brandLogo: true
    },
    delivery: {
      method: "DOWNLOAD"
    }
  })
  
  const [exporting, setExporting] = useState(false)
  const [exportComplete, setExportComplete] = useState(false)

  const formatOptions = [
    {
      id: "PDF",
      name: "PDF Report",
      description: "Professional formatted report with charts",
      icon: FileText,
      recommended: true
    },
    {
      id: "EXCEL",
      name: "Excel Workbook",
      description: "Detailed data with multiple worksheets",
      icon: FileSpreadsheet,
      recommended: false
    },
    {
      id: "CSV",
      name: "CSV Data",
      description: "Raw data export for analysis",
      icon: FileSpreadsheet,
      recommended: false
    },
    {
      id: "JSON",
      name: "JSON API",
      description: "Structured data for integration",
      icon: Settings,
      recommended: false
    }
  ]

  const audienceProfiles = [
    {
      id: "EXECUTIVE",
      name: "Executive Summary",
      description: "High-level insights and strategic recommendations",
      features: ["Strategic overview", "Key metrics", "ROI analysis"]
    },
    {
      id: "HR_MANAGER",
      name: "HR Manager",
      description: "Comprehensive analysis with actionable insights",
      features: ["Detailed candidate analysis", "Hiring recommendations", "Process insights"]
    },
    {
      id: "TECHNICAL",
      name: "Technical Team",
      description: "Skills-focused analysis with technical details",
      features: ["Skills breakdown", "Technical assessments", "Capability matrix"]
    },
    {
      id: "DETAILED",
      name: "Detailed Analysis",
      description: "Complete report with all available data",
      features: ["All sections", "Raw data", "Statistical details"]
    }
  ]

  const handleSectionToggle = (section: keyof ExportOptions['sections']) => {
    setExportOptions(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: !prev.sections[section]
      }
    }))
  }

  const handleExport = async () => {
    setExporting(true)
    
    try {
      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          evaluationId,
          options: exportOptions,
          analyticsData
        })
      })

      if (response.ok) {
        if (exportOptions.delivery.method === "DOWNLOAD") {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `analytics-report-${evaluationId}.${exportOptions.format.toLowerCase()}`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
        
        setExportComplete(true)
        setTimeout(() => {
          setExportComplete(false)
          onOpenChange(false)
        }, 2000)
      } else {
        throw new Error('Export failed')
      }
    } catch (error) {
      console.error('Export error:', error)
    } finally {
      setExporting(false)
    }
  }

  const getSelectedSectionsCount = () => {
    return Object.values(exportOptions.sections).filter(Boolean).length
  }

  if (exportComplete) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Export Complete!</h3>
            <p className="text-gray-600 mb-4">
              Your analytics report has been {exportOptions.delivery.method === "DOWNLOAD" ? "downloaded" : "sent"} successfully.
            </p>
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Analytics Report
          </DialogTitle>
          <p className="text-sm text-gray-600">
            Generate a comprehensive report for {analyticsData?.roleName} evaluation
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Report Format</CardTitle>
              <p className="text-sm text-gray-600">Choose the output format for your report</p>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={exportOptions.format}
                onValueChange={(value) => setExportOptions(prev => ({ ...prev, format: value as any }))}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {formatOptions.map((format) => (
                    <div key={format.id} className="relative">
                      <RadioGroupItem value={format.id} id={format.id} className="peer sr-only" />
                      <Label
                        htmlFor={format.id}
                        className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 peer-checked:border-blue-500 peer-checked:bg-blue-50"
                      >
                        <format.icon className="h-5 w-5 text-gray-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{format.name}</span>
                            {format.recommended && (
                              <Badge variant="default" className="text-xs">Recommended</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{format.description}</p>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Audience Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Target Audience</CardTitle>
              <p className="text-sm text-gray-600">Customize content for your intended audience</p>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={exportOptions.audience}
                onValueChange={(value) => setExportOptions(prev => ({ ...prev, audience: value as any }))}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {audienceProfiles.map((profile) => (
                    <div key={profile.id} className="relative">
                      <RadioGroupItem value={profile.id} id={profile.id} className="peer sr-only" />
                      <Label
                        htmlFor={profile.id}
                        className="flex flex-col p-4 border rounded-lg cursor-pointer hover:bg-gray-50 peer-checked:border-blue-500 peer-checked:bg-blue-50"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">{profile.name}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{profile.description}</p>
                        <div className="space-y-1">
                          {profile.features.map((feature, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs text-gray-500">
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Sections Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Report Sections
                <Badge variant="outline">
                  {getSelectedSectionsCount()} of {Object.keys(exportOptions.sections).length} selected
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-600">Choose which sections to include in your report</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(exportOptions.sections).map(([key, checked]) => {
                  const sectionConfig = {
                    executiveSummary: { name: "Executive Summary", icon: Brain, description: "AI-generated strategic overview" },
                    scoreDistribution: { name: "Score Distribution", icon: BarChart3, description: "Statistical analysis of scores" },
                    skillsAnalysis: { name: "Skills Analysis", icon: Settings, description: "Skills performance and gaps" },
                    candidateComparison: { name: "Candidate Comparison", icon: Users, description: "Top candidates analysis" },
                    aiInsights: { name: "AI Insights", icon: Brain, description: "Predictive analytics and recommendations" },
                    recommendations: { name: "Recommendations", icon: CheckCircle, description: "Strategic action items" },
                    charts: { name: "Charts & Visualizations", icon: Image, description: "Interactive charts and graphs" }
                  }
                  
                  const config = sectionConfig[key as keyof typeof sectionConfig]
                  
                  return (
                    <div key={key} className="flex items-start gap-3 p-3 border rounded">
                      <Checkbox
                        id={key}
                        checked={checked}
                        onCheckedChange={() => handleSectionToggle(key as keyof ExportOptions['sections'])}
                      />
                      <div className="flex-1">
                        <Label htmlFor={key} className="flex items-center gap-2 cursor-pointer">
                          <config.icon className="h-4 w-4 text-gray-600" />
                          <span className="font-medium">{config.name}</span>
                        </Label>
                        <p className="text-xs text-gray-500 mt-1">{config.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Customization Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customization Options</CardTitle>
              <p className="text-sm text-gray-600">Configure report details and privacy settings</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="includeRawData" className="font-medium">Include Raw Data</Label>
                    <p className="text-sm text-gray-600">Add detailed data tables and statistics</p>
                  </div>
                  <Checkbox
                    id="includeRawData"
                    checked={exportOptions.customization.includeRawData}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({
                        ...prev,
                        customization: { ...prev.customization, includeRawData: !!checked }
                      }))
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="includeCandidateNames" className="font-medium">Include Candidate Names</Label>
                    <p className="text-sm text-gray-600">Show actual candidate names (disable for anonymity)</p>
                  </div>
                  <Checkbox
                    id="includeCandidateNames"
                    checked={exportOptions.customization.includeCandidateNames}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({
                        ...prev,
                        customization: { ...prev.customization, includeCandidateNames: !!checked }
                      }))
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="includeConfidentialInfo" className="font-medium">Include Confidential Information</Label>
                    <p className="text-sm text-gray-600">Add sensitive details like contact information</p>
                  </div>
                  <Checkbox
                    id="includeConfidentialInfo"
                    checked={exportOptions.customization.includeConfidentialInfo}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({
                        ...prev,
                        customization: { ...prev.customization, includeConfidentialInfo: !!checked }
                      }))
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="brandLogo" className="font-medium">Include Company Branding</Label>
                    <p className="text-sm text-gray-600">Add your company logo and branding</p>
                  </div>
                  <Checkbox
                    id="brandLogo"
                    checked={exportOptions.customization.brandLogo}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({
                        ...prev,
                        customization: { ...prev.customization, brandLogo: !!checked }
                      }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Delivery Method</CardTitle>
              <p className="text-sm text-gray-600">Choose how to receive your report</p>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={exportOptions.delivery.method}
                onValueChange={(value) => setExportOptions(prev => ({ 
                  ...prev, 
                  delivery: { ...prev.delivery, method: value as any }
                }))}
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="DOWNLOAD" id="download" />
                    <Label htmlFor="download" className="flex items-center gap-2 cursor-pointer">
                      <Download className="h-4 w-4" />
                      <span>Download Immediately</span>
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="EMAIL" id="email" />
                    <Label htmlFor="email" className="flex items-center gap-2 cursor-pointer">
                      <Mail className="h-4 w-4" />
                      <span>Send via Email</span>
                    </Label>
                  </div>
                  
                  {exportOptions.delivery.method === "EMAIL" && (
                    <div className="ml-6 mt-2">
                      <Label htmlFor="emailAddress" className="text-sm">Email Address</Label>
                      <Input
                        id="emailAddress"
                        type="email"
                        placeholder="your@email.com"
                        value={exportOptions.delivery.email || ""}
                        onChange={(e) => setExportOptions(prev => ({
                          ...prev,
                          delivery: { ...prev.delivery, email: e.target.value }
                        }))}
                        className="mt-1"
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="SCHEDULED" id="scheduled" />
                    <Label htmlFor="scheduled" className="flex items-center gap-2 cursor-pointer">
                      <Clock className="h-4 w-4" />
                      <span>Schedule for Later</span>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t">
            <div className="text-sm text-gray-600">
              {getSelectedSectionsCount() === 0 && (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>Please select at least one section to export</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={exporting}
              >
                Cancel
              </Button>
              
              <Button
                onClick={handleExport}
                disabled={exporting || getSelectedSectionsCount() === 0}
                className="min-w-32"
              >
                {exporting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Exporting...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    <span>Export Report</span>
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}