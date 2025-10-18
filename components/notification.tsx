import { AlertCircle, CheckCircle } from "lucide-react"

interface NotificationProps {
  message: string
  isError?: boolean
}

export function Notification({ message, isError = false }: NotificationProps) {
  return (
    <div
      className={`fixed bottom-4 right-4 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-bottom-4 ${
        isError ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
      }`}
    >
      {isError ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
}
