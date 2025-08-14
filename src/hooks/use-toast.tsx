import { useEffect, useState } from "react"

export interface Toast {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: "default" | "destructive"
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  toast: (toast: Omit<Toast, "id">) => void
  dismiss: (toastId?: string) => void
}

const listeners: Array<(state: ToastContextValue) => void> = []

let memoryState: ToastContextValue = {
  toasts: [],
  toast: () => {},
  dismiss: () => {},
}

function dispatch(action: (state: ToastContextValue) => ToastContextValue) {
  memoryState = action(memoryState)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

function toast({ ...props }: Omit<Toast, "id">) {
  const id = String(Date.now())
  const duration = props.duration || 5000

  dispatch((state) => ({
    ...state,
    toasts: [
      ...state.toasts,
      {
        id,
        ...props,
      },
    ],
  }))

  // Auto dismiss after duration
  if (duration > 0) {
    setTimeout(() => {
      dismiss(id)
    }, duration)
  }

  return id
}

function dismiss(toastId?: string) {
  dispatch((state) => ({
    ...state,
    toasts: toastId
      ? state.toasts.filter((t) => t.id !== toastId)
      : [],
  }))
}

export function useToast() {
  const [state, setState] = useState<ToastContextValue>(memoryState)

  useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss,
  }
}