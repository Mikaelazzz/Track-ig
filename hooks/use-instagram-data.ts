"use client"

import { useState, useCallback } from "react"

interface User {
  username: string
  full_name?: string
  timestamp?: number
}

interface InstagramData {
  followers_1: User[]
  following: User[]
  blocked_profile: User[]
  close_friends: User[]
  hide_story_from: User[]
  pending_follow_request: User[]
  recent_follow_request: User[]
  recently_unfollowed_profiles: User[]
}

export function useInstagramData() {
  const [data, setData] = useState<InstagramData>({
    followers_1: [],
    following: [],
    blocked_profile: [],
    close_friends: [],
    hide_story_from: [],
    pending_follow_request: [],
    recent_follow_request: [],
    recently_unfollowed_profiles: [],
  })

  const updateData = useCallback((category: keyof InstagramData, newData: User[]) => {
    setData((prev) => ({
      ...prev,
      [category]: newData,
    }))
  }, [])

  const deleteData = useCallback((category: keyof InstagramData) => {
    setData((prev) => ({
      ...prev,
      [category]: [],
    }))
  }, [])

  const stats = {
    followers: data.followers_1.length,
    following: data.following.length,
    notFollowingBack: data.following.filter(
      (user) => !data.followers_1.some((f) => f.username.toLowerCase() === user.username.toLowerCase()),
    ).length,
    blocked: data.blocked_profile.length,
    closeFriends: data.close_friends.length,
  }

  return { data, updateData, deleteData, stats }
}
