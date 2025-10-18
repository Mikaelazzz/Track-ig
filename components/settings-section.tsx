"use client"

import { useState } from "react"
import { Settings } from "lucide-react"

export function SettingsSection() {
  const [useInstagramAvatars, setUseInstagramAvatars] = useState(false)
  const [lazyLoadAvatars, setLazyLoadAvatars] = useState(true)

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <Settings className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Display Settings</h3>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={useInstagramAvatars}
            onChange={(e) => setUseInstagramAvatars(e.target.checked)}
            className="w-4 h-4 rounded border-border"
          />
          <span className="text-sm">Use original Instagram profile pictures</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={lazyLoadAvatars}
            onChange={(e) => setLazyLoadAvatars(e.target.checked)}
            className="w-4 h-4 rounded border-border"
          />
          <span className="text-sm">Lazy load profile pictures</span>
        </label>
      </div>

      <div className="mt-6 p-4 bg-muted rounded-lg">
        <h4 className="font-semibold text-sm mb-2">How to get your data:</h4>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Go to Instagram Settings → Your activity → Download your information</li>
          <li>Select JSON format and request your data</li>
          <li>Download the file and extract it</li>
          <li>Upload the JSON files here</li>
        </ol>
      </div>
    </div>
  )
}
