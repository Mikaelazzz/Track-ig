// Instagram Avatar Cache Utility
// Manages localStorage caching for profile pictures

const CACHE_KEY_PREFIX = "ig_avatar_"
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

export interface CachedAvatar {
  url: string
  timestamp: number
}

export interface CacheStats {
  total: number
  valid: number
  expired: number
  size: string
}

/**
 * Get cached avatar URL if it exists and is not expired
 */
export function getCachedAvatar(username: string): string | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + username)
    if (!cached) return null

    const data: CachedAvatar = JSON.parse(cached)
    const now = Date.now()

    if (now - data.timestamp < CACHE_DURATION) {
      return data.url
    } else {
      // Cache expired
      localStorage.removeItem(CACHE_KEY_PREFIX + username)
      return null
    }
  } catch (error) {
    console.error("[Avatar Cache] Error reading cache:", error)
    return null
  }
}

/**
 * Save avatar URL to cache
 */
export function setCachedAvatar(username: string, url: string): boolean {
  try {
    const data: CachedAvatar = {
      url,
      timestamp: Date.now()
    }
    localStorage.setItem(CACHE_KEY_PREFIX + username, JSON.stringify(data))
    return true
  } catch (error) {
    // Handle quota exceeded
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn("[Avatar Cache] Storage quota exceeded, clearing old caches")
      clearOldCaches()
      try {
        const data: CachedAvatar = { url, timestamp: Date.now() }
        localStorage.setItem(CACHE_KEY_PREFIX + username, JSON.stringify(data))
        return true
      } catch (e) {
        console.error("[Avatar Cache] Failed to save even after clearing:", e)
        return false
      }
    }
    console.error("[Avatar Cache] Error saving cache:", error)
    return false
  }
}

/**
 * Remove cached avatar for a specific user
 */
export function removeCachedAvatar(username: string): void {
  try {
    localStorage.removeItem(CACHE_KEY_PREFIX + username)
  } catch (error) {
    console.error("[Avatar Cache] Error removing cache:", error)
  }
}

/**
 * Clear old caches (older than 12 hours) to free up space
 */
export function clearOldCaches(): number {
  const keysToRemove: string[] = []
  const halfDuration = CACHE_DURATION / 2

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(CACHE_KEY_PREFIX)) {
      try {
        const cached = localStorage.getItem(key)
        if (cached) {
          const data: CachedAvatar = JSON.parse(cached)
          const age = Date.now() - data.timestamp
          if (age > halfDuration) {
            keysToRemove.push(key)
          }
        }
      } catch (e) {
        // Invalid cache entry, remove it
        keysToRemove.push(key)
      }
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))
  console.log(`[Avatar Cache] Cleared ${keysToRemove.length} old entries`)
  return keysToRemove.length
}

/**
 * Clear all avatar caches
 */
export function clearAllCaches(): number {
  const keysToRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(CACHE_KEY_PREFIX)) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))
  console.log(`[Avatar Cache] Cleared all ${keysToRemove.length} caches`)
  return keysToRemove.length
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  let total = 0
  let valid = 0
  let expired = 0
  let totalSize = 0

  const now = Date.now()

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(CACHE_KEY_PREFIX)) {
      total++
      try {
        const cached = localStorage.getItem(key)
        if (cached) {
          totalSize += cached.length * 2 // Approximate size in bytes (UTF-16)
          const data: CachedAvatar = JSON.parse(cached)
          const age = now - data.timestamp
          if (age < CACHE_DURATION) {
            valid++
          } else {
            expired++
          }
        }
      } catch (e) {
        expired++
      }
    }
  }

  return {
    total,
    valid,
    expired,
    size: formatBytes(totalSize)
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Check if localStorage is available
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch (e) {
    return false
  }
}

/**
 * Preload avatars for multiple users (batch operation)
 */
export async function preloadAvatars(
  usernames: string[],
  onProgress?: (loaded: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  for (let i = 0; i < usernames.length; i++) {
    const username = usernames[i]
    
    // Skip if already cached
    if (getCachedAvatar(username)) {
      success++
      if (onProgress) onProgress(i + 1, usernames.length)
      continue
    }

    try {
      const response = await fetch(`/api/instagram-profile?username=${encodeURIComponent(username)}`)
      if (response.ok) {
        const data = await response.json()
        if (data.profilePicUrl) {
          setCachedAvatar(username, data.profilePicUrl)
          success++
        } else {
          failed++
        }
      } else {
        failed++
      }
    } catch (error) {
      console.error(`[Preload] Failed for ${username}:`, error)
      failed++
    }

    if (onProgress) onProgress(i + 1, usernames.length)
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return { success, failed }
}
