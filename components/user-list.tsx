"use client"

import { useState, useEffect } from "react"
import { UserCard } from "./user-card"
import { Users } from "lucide-react"

interface User {
  username: string
  full_name?: string
  timestamp?: number
}

interface UserListProps {
  users: User[]
  followers: User[]
  showNotFollowingBackOnly?: boolean
  showProfileButton?: boolean
}

export function UserList({
  users,
  followers,
  showNotFollowingBackOnly = false,
  showProfileButton = false,
}: UserListProps) {
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])

  useEffect(() => {
    let result = [...users]

    if (showNotFollowingBackOnly && followers.length > 0) {
      const followerUsernames = new Set(followers.map((f) => f.username.toLowerCase()))
      result = result.filter((user) => !followerUsernames.has(user.username.toLowerCase()))
    }

    setFilteredUsers(result)
  }, [users, followers, showNotFollowingBackOnly])

  if (filteredUsers.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-12 text-center shadow-sm">
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="text-muted-foreground">No users to display</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredUsers.map((user) => (
        <UserCard
          key={user.username}
          user={user}
          isNotFollowingBack={
            showNotFollowingBackOnly ||
            (followers.length > 0 && !followers.some((f) => f.username.toLowerCase() === user.username.toLowerCase()))
          }
          showProfileButton={showProfileButton}
        />
      ))}
    </div>
  )
}
