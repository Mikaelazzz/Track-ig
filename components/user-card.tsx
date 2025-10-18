"use client"

import { useState, useEffect } from "react"
import { ExternalLink } from "lucide-react"

interface User {
  username: string
  full_name?: string
  timestamp?: number
}

interface UserCardProps {
  user: User
  isNotFollowingBack?: boolean
  showProfileButton?: boolean
}

export function UserCard({ user, isNotFollowingBack = false, showProfileButton = false }: UserCardProps) {
  const [avatarUrl, setAvatarUrl] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Use UI Avatars as fallback
    const url = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=d946ef&color=fff&size=100`
    setAvatarUrl(url)
    setIsLoading(false)
  }, [user.username])

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return ""
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <div
      className={`bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${
        isNotFollowingBack ? "border-destructive/50" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        {isLoading ? (
          <div className="w-12 h-12 bg-muted rounded-full animate-pulse" />
        ) : (
          <img
            src={avatarUrl || "/placeholder.svg"}
            alt={user.username}
            className="w-12 h-12 rounded-full object-cover"
          />
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm truncate">@{user.username}</h4>
          {user.full_name && <p className="text-xs text-muted-foreground truncate">{user.full_name}</p>}
          {user.timestamp && <p className="text-xs text-muted-foreground mt-1">{formatDate(user.timestamp)}</p>}
        </div>
      </div>

      {isNotFollowingBack && (
        <div className="mb-3 px-2 py-1 bg-destructive/10 text-destructive text-xs rounded font-medium">
          Not following back
        </div>
      )}

      {showProfileButton && (
        <a
          href={`https://www.instagram.com/${user.username}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <ExternalLink className="w-4 h-4" />
          View Profile
        </a>
      )}
    </div>
  )
}
