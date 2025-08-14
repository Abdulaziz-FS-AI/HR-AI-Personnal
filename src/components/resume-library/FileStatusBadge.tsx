"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react"

interface FileStatusBadgeProps {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  confidence?: number
  className?: string
}

export function FileStatusBadge({ status, confidence, className }: FileStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          label: 'Ready',
          icon: CheckCircle,
          className: 'bg-green-100 text-green-800 border-green-200',
          iconColor: 'text-green-600'
        }
      case 'processing':
        return {
          label: 'Processing',
          icon: Loader2,
          className: 'bg-blue-100 text-blue-800 border-blue-200',
          iconColor: 'text-blue-600 animate-spin'
        }
      case 'pending':
        return {
          label: 'Pending',
          icon: Clock,
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          iconColor: 'text-yellow-600'
        }
      case 'failed':
        return {
          label: 'Failed',
          icon: AlertCircle,
          className: 'bg-red-100 text-red-800 border-red-200',
          iconColor: 'text-red-600'
        }
      default:
        return {
          label: 'Unknown',
          icon: AlertCircle,
          className: 'bg-gray-100 text-gray-800 border-gray-200',
          iconColor: 'text-gray-600'
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <div className="flex items-center space-x-2">
      <Badge
        variant="outline"
        className={cn(config.className, className)}
      >
        <Icon className={cn("w-3 h-3 mr-1", config.iconColor)} />
        {config.label}
      </Badge>
      
      {status === 'completed' && confidence && (
        <span className="text-xs text-gray-500">
          {confidence}%
        </span>
      )}
    </div>
  )
}