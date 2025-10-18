"use client"

import { Trash2, Database } from "lucide-react"

interface UploadedDataManagerProps {
  data: any
  onDataDelete: (category: string) => void
  onNotification: (message: string, isError?: boolean) => void
}

export function UploadedDataManager({ data, onDataDelete, onNotification }: UploadedDataManagerProps) {
  const categories = [
    { key: "followers_1", label: "Followers" },
    { key: "following", label: "Following" },
    { key: "blocked_profile", label: "Blocked Profiles" },
    { key: "close_friends", label: "Close Friends" },
    { key: "hide_story_from", label: "Hide Story From" },
    { key: "pending_follow_request", label: "Pending Requests" },
    { key: "recent_follow_request", label: "Recent Requests" },
    { key: "recently_unfollowed_profiles", label: "Recently Unfollowed" },
  ]

  const uploadedCategories = categories.filter((cat) => data[cat.key]?.length > 0)

  if (uploadedCategories.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm text-center">
        <Database className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No data uploaded yet</p>
      </div>
    )
  }

  const handleClearAll = () => {
    if (confirm("Are you sure you want to delete all uploaded data? This action cannot be undone.")) {
      uploadedCategories.forEach((cat) => {
        onDataDelete(cat.key)
      })
      onNotification("All data cleared successfully")
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Uploaded Data</h3>
        </div>
        <button
          onClick={handleClearAll}
          className="text-xs px-3 py-1 bg-destructive text-destructive-foreground rounded hover:opacity-90 transition-opacity"
        >
          Clear All
        </button>
      </div>

      <div className="space-y-2">
        {uploadedCategories.map((cat) => (
          <div
            key={cat.key}
            className="flex items-center justify-between bg-muted p-3 rounded-lg hover:bg-muted/80 transition-colors"
          >
            <div className="flex-1">
              <p className="text-sm font-medium">{cat.label}</p>
              <p className="text-xs text-muted-foreground">{data[cat.key].length} entries</p>
            </div>
            <button
              onClick={() => {
                if (confirm(`Delete ${cat.label}?`)) {
                  onDataDelete(cat.key)
                  onNotification(`${cat.label} deleted`)
                }
              }}
              className="p-2 hover:bg-destructive/20 rounded transition-colors"
              title="Delete this data"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
