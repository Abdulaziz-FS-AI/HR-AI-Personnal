"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Users, 
  Search, 
  SortAsc, 
  SortDesc, 
  Eye, 
  Star, 
  TrendingUp,
  Award,
  AlertTriangle,
  MoreVertical,
  Filter
} from "lucide-react"

interface Candidate {
  id: string
  name: string
  email: string
  finalScore: number
  baseScore: number
  bonusPoints: number
  penaltyPoints: number
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW"
  successPrediction: number
  retentionRisk: "LOW" | "MEDIUM" | "HIGH"
  skills: string[]
  strengths: string[]
  concerns: string[]
  hiringRecommendation: "STRONG_HIRE" | "HIRE" | "MAYBE" | "NO_HIRE"
  analysisDate: string
}

interface CandidateComparisonTableProps {
  evaluationId: string
  totalCandidates: number
}

export function CandidateComparisonTable({ evaluationId, totalCandidates }: CandidateComparisonTableProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<keyof Candidate>("finalScore")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [filterBy, setFilterBy] = useState<string>("all")

  useEffect(() => {
    loadCandidates()
  }, [evaluationId])

  const loadCandidates = async () => {
    try {
      setLoading(true)
      
      // Fetch candidate comparison data
      const response = await fetch(`/api/analytics/visualizations/${evaluationId}?chartType=candidateComparison`)
      const result = await response.json()
      
      if (response.ok && result.success) {
        setCandidates(result.data.candidates || [])
      } else {
        console.error('Failed to load candidates:', result.error)
      }
    } catch (error) {
      console.error('Error loading candidates:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort candidates
  const filteredCandidates = candidates
    .filter(candidate => {
      const matchesSearch = candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           candidate.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesFilter = filterBy === "all" ||
                           (filterBy === "strong_hire" && candidate.hiringRecommendation === "STRONG_HIRE") ||
                           (filterBy === "high_confidence" && candidate.confidenceLevel === "HIGH") ||
                           (filterBy === "top_scores" && candidate.finalScore >= 85)
      
      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      const aValue = a[sortBy]
      const bValue = b[sortBy]
      
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortOrder === "desc" ? bValue - aValue : aValue - bValue
      } else {
        const aStr = String(aValue).toLowerCase()
        const bStr = String(bValue).toLowerCase()
        return sortOrder === "desc" ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr)
      }
    })

  const handleSort = (field: keyof Candidate) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc")
    } else {
      setSortBy(field)
      setSortOrder("desc")
    }
  }

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case "STRONG_HIRE": return "bg-green-100 text-green-800 border-green-200"
      case "HIRE": return "bg-blue-100 text-blue-800 border-blue-200"
      case "MAYBE": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "NO_HIRE": return "bg-red-100 text-red-800 border-red-200"
      default: return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "HIGH": return "text-green-600"
      case "MEDIUM": return "text-yellow-600"
      case "LOW": return "text-red-600"
      default: return "text-gray-600"
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Loading Candidates...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Candidates Analysis
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Comprehensive comparison and ranking of evaluated candidates
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {filteredCandidates.length} of {totalCandidates} candidates
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-6">
          {/* Search and Filter Controls */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search candidates, skills, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter: {filterBy === "all" ? "All" : filterBy.replace("_", " ").toUpperCase()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setFilterBy("all")}>
                  All Candidates
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterBy("strong_hire")}>
                  Strong Hire Only
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterBy("high_confidence")}>
                  High Confidence Only
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterBy("top_scores")}>
                  Top Scores (85+)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Candidates Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Candidate</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("finalScore")}
                  >
                    <div className="flex items-center gap-1">
                      Final Score
                      {sortBy === "finalScore" && (
                        sortOrder === "desc" ? <SortDesc className="h-3 w-3" /> : <SortAsc className="h-3 w-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Score Breakdown</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("successPrediction")}
                  >
                    <div className="flex items-center gap-1">
                      Success Prediction
                      {sortBy === "successPrediction" && (
                        sortOrder === "desc" ? <SortDesc className="h-3 w-3" /> : <SortAsc className="h-3 w-3" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Skills & Strengths</TableHead>
                  <TableHead>Recommendation</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.map((candidate) => (
                  <TableRow key={candidate.id} className="hover:bg-gray-50">
                    {/* Candidate Info */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{candidate.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{candidate.name}</div>
                          <div className="text-sm text-gray-500">{candidate.email}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getConfidenceColor(candidate.confidenceLevel)}`}
                            >
                              {candidate.confidenceLevel} Confidence
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Final Score */}
                    <TableCell>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {candidate.finalScore}
                        </div>
                        <div className="text-xs text-gray-500">
                          {candidate.finalScore >= 90 && <Star className="h-3 w-3 text-yellow-500 inline" />}
                          /100
                        </div>
                      </div>
                    </TableCell>

                    {/* Score Breakdown */}
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span>Base:</span>
                          <span className="font-medium">{candidate.baseScore}</span>
                        </div>
                        {candidate.bonusPoints > 0 && (
                          <div className="flex items-center justify-between text-xs text-green-600">
                            <span>Bonus:</span>
                            <span className="font-medium">+{candidate.bonusPoints}</span>
                          </div>
                        )}
                        {candidate.penaltyPoints > 0 && (
                          <div className="flex items-center justify-between text-xs text-red-600">
                            <span>Penalty:</span>
                            <span className="font-medium">-{candidate.penaltyPoints}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Success Prediction */}
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{candidate.successPrediction}%</span>
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        </div>
                        <Progress value={candidate.successPrediction} className="h-2" />
                        <div className="text-xs text-gray-500">
                          Retention: <span className={
                            candidate.retentionRisk === "LOW" ? "text-green-600" :
                            candidate.retentionRisk === "MEDIUM" ? "text-yellow-600" : "text-red-600"
                          }>
                            {candidate.retentionRisk} Risk
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Skills & Strengths */}
                    <TableCell>
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Top Skills:</div>
                          <div className="flex flex-wrap gap-1">
                            {candidate.skills.slice(0, 3).map((skill, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {candidate.skills.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{candidate.skills.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Strengths:</div>
                          <div className="text-xs">
                            {candidate.strengths.slice(0, 2).join(", ")}
                            {candidate.strengths.length > 2 && "..."}
                          </div>
                        </div>

                        {candidate.concerns.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="h-3 w-3" />
                            <span>{candidate.concerns.length} concern{candidate.concerns.length !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Recommendation */}
                    <TableCell>
                      <Badge className={`${getRecommendationColor(candidate.hiringRecommendation)} border`}>
                        {candidate.hiringRecommendation === "STRONG_HIRE" && <Award className="h-3 w-3 mr-1" />}
                        {candidate.hiringRecommendation.replace("_", " ")}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            Compare Candidates
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            Export Profile
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredCandidates.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No candidates found</h3>
              <p className="text-gray-600">
                {searchTerm || filterBy !== "all" 
                  ? "Try adjusting your search or filter criteria"
                  : "No candidates have been evaluated yet"
                }
              </p>
            </div>
          )}

          {/* Summary Stats */}
          {filteredCandidates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center p-3 bg-green-50 rounded border border-green-200">
                <div className="text-lg font-bold text-green-700">
                  {filteredCandidates.filter(c => c.hiringRecommendation === "STRONG_HIRE").length}
                </div>
                <div className="text-xs text-green-600">Strong Hire</div>
              </div>
              
              <div className="text-center p-3 bg-blue-50 rounded border border-blue-200">
                <div className="text-lg font-bold text-blue-700">
                  {(filteredCandidates.reduce((sum, c) => sum + c.finalScore, 0) / filteredCandidates.length).toFixed(1)}
                </div>
                <div className="text-xs text-blue-600">Avg Score</div>
              </div>
              
              <div className="text-center p-3 bg-purple-50 rounded border border-purple-200">
                <div className="text-lg font-bold text-purple-700">
                  {filteredCandidates.filter(c => c.confidenceLevel === "HIGH").length}
                </div>
                <div className="text-xs text-purple-600">High Confidence</div>
              </div>
              
              <div className="text-center p-3 bg-orange-50 rounded border border-orange-200">
                <div className="text-lg font-bold text-orange-700">
                  {(filteredCandidates.reduce((sum, c) => sum + c.successPrediction, 0) / filteredCandidates.length).toFixed(0)}%
                </div>
                <div className="text-xs text-orange-600">Avg Success Prediction</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}