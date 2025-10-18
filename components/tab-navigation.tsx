"use client"

interface TabNavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const tabs = [
  { id: "upload_all", label: "Upload All Data" },
  { id: "followers_1", label: "Followers" },
  { id: "following", label: "Following" },
  { id: "blocked_profile", label: "Blocked" },
  { id: "close_friends", label: "Close Friends" },
  { id: "hide_story_from", label: "Hide Story From" },
  { id: "pending_follow_request", label: "Pending Requests" },
  { id: "recent_follow_request", label: "Recent Requests" },
  { id: "recently_unfollowed_profiles", label: "Recently Unfollowed" },
]

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="flex flex-wrap gap-2 bg-card border border-border rounded-lg p-2 shadow-sm">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === tab.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
