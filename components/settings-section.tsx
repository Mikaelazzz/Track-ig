"use client"

import { useState, useEffect } from "react"
import { Settings, Trash2, Database, RefreshCw } from "lucide-react"
import { getCacheStats, clearAllCaches, clearOldCaches } from "@/lib/avatar-cache"

export function SettingsSection() {
  const [useInstagramAvatars, setUseInstagramAvatars] = useState(false)
  const [lazyLoadAvatars, setLazyLoadAvatars] = useState(true)
  const [cacheStats, setCacheStats] = useState({ total: 0, valid: 0, expired: 0, size: "0 Bytes" })
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    updateCacheStats()
  }, [])

  const updateCacheStats = () => {
    const stats = getCacheStats()
    setCacheStats(stats)
  }

  const handleClearAllCache = () => {
    if (confirm("Clear all cached profile pictures? They will be re-fetched on next view.")) {
      setClearing(true)
      const cleared = clearAllCaches()
      updateCacheStats()
      setClearing(false)
      alert(`Cleared ${cleared} cached avatars! ✓`)
    }
  }

  const handleClearOldCache = () => {
    setClearing(true)
    const cleared = clearOldCaches()
    updateCacheStats()
    setClearing(false)
    if (cleared > 0) {
      alert(`Cleared ${cleared} old cached avatars! ✓`)
    } else {
      alert("No old caches to clear.")
    }
  }

  const handleMigrateCache = () => {
    if (confirm("Convert old Instagram CDN URLs to proxied URLs? This will fix CORS errors.")) {
      setClearing(true)
      let migrated = 0
      
      // Find all cached avatars
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('ig_avatar_')) {
          try {
            const cached = localStorage.getItem(key)
            if (cached) {
              const data = JSON.parse(cached)
              // If URL is Instagram CDN and not proxied yet
              if (data.url.includes('cdninstagram.com') && !data.url.startsWith('/api/proxy-image')) {
                const proxiedUrl = `/api/proxy-image?url=${encodeURIComponent(data.url)}`
                const newData = {
                  url: proxiedUrl,
                  timestamp: data.timestamp
                }
                localStorage.setItem(key, JSON.stringify(newData))
                migrated++
              }
            }
          } catch (error) {
            console.error('Error migrating cache:', error)
          }
        }
      }
      
      updateCacheStats()
      setClearing(false)
      alert(`✅ Migrated ${migrated} cached URLs to use proxy! Reload the page to see changes.`)
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-sm space-y-6">
      {/* Display Settings */}
      <div>
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
      </div>

      {/* Cache Management */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Database className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Cache Management</h3>
        </div>

        <div className="bg-muted rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Cached</p>
              <p className="text-lg font-bold">{cacheStats.total}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valid</p>
              <p className="text-lg font-bold text-green-600">{cacheStats.valid}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expired</p>
              <p className="text-lg font-bold text-red-600">{cacheStats.expired}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cache Size</p>
              <p className="text-lg font-bold">{cacheStats.size}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            ⚡ Cached avatars load instantly! Cache expires after 24 hours.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={updateCacheStats}
            disabled={clearing}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${clearing ? 'animate-spin' : ''}`} />
            Refresh Stats
          </button>

          <button
            onClick={handleMigrateCache}
            disabled={clearing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Database className="w-4 h-4" />
            Fix CORS Errors
          </button>

          <button
            onClick={handleClearOldCache}
            disabled={clearing}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Clear Old Cache
          </button>

          <button
            onClick={handleClearAllCache}
            disabled={clearing}
            className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Clear All Cache
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-muted rounded-lg">
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
