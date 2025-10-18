"use client"

import { useState } from "react"
import { UploadSection } from "./upload-section"
import { UserList } from "./user-list"
import { SettingsSection } from "./settings-section"
import { UploadedDataManager } from "./uploaded-data-manager"

interface TabContentProps {
  activeTab: string
  data: any
  onDataUpdate: (category: string, data: any) => void
  onDataDelete: (category: string) => void
  onNotification: (message: string, isError?: boolean) => void
}

export function TabContent({ activeTab, data, onDataUpdate, onDataDelete, onNotification }: TabContentProps) {
  const [showNotFollowingBackOnly, setShowNotFollowingBackOnly] = useState(false)

  const categoryMap: Record<string, { title: string; fileKey: string; dataKey?: string }> = {
    upload_all: { title: "Upload All Data", fileKey: "all", dataKey: undefined },
    followers_1: { title: "Followers", fileKey: "followers_1", dataKey: undefined },
    following: { title: "Following", fileKey: "following", dataKey: "relationships_following" },
    blocked_profile: { title: "Blocked Profiles", fileKey: "blocked_profile", dataKey: "relationships_blocked_users" },
    close_friends: { title: "Close Friends", fileKey: "close_friends", dataKey: "relationships_close_friends" },
    hide_story_from: {
      title: "Hide Story From",
      fileKey: "hide_story_from",
      dataKey: "relationships_hide_stories_from",
    },
    pending_follow_request: {
      title: "Pending Requests",
      fileKey: "pending_follow_request",
      dataKey: "relationships_follow_requests_sent",
    },
    recent_follow_request: {
      title: "Recent Requests",
      fileKey: "recent_follow_request",
      dataKey: "relationships_permanent_follow_requests",
    },
    recently_unfollowed_profiles: {
      title: "Recently Unfollowed",
      fileKey: "recently_unfollowed_profiles",
      dataKey: "relationships_unfollowed_users",
    },
  }

  const config = categoryMap[activeTab]

  if (activeTab === "upload_all") {
    return (
      <div className="mt-6 space-y-6">
        <UploadSection isMultiple={true} onDataUpdate={onDataUpdate} onNotification={onNotification} />
        <UploadedDataManager data={data} onDataDelete={onDataDelete} onNotification={onNotification} />
        <SettingsSection />
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-6">
      {activeTab === "following" && (
        <div className="bg-card border border-border rounded-lg p-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showNotFollowingBackOnly}
              onChange={(e) => setShowNotFollowingBackOnly(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm font-medium">Show only users not following back</span>
          </label>
        </div>
      )}

      <UserList
        users={data[config.fileKey] || []}
        followers={data.followers_1 || []}
        showNotFollowingBackOnly={showNotFollowingBackOnly && activeTab === "following"}
        showProfileButton={activeTab === "following"}
      />
    </div>
  )
}
