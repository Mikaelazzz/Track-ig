"use client"

import { useState, useEffect, useRef } from "react"
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

interface CachedAvatar {
  url: string
  timestamp: number
}

// LocalStorage cache management
const CACHE_KEY_PREFIX = "ig_avatar_"
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
const FETCH_TIMEOUT = 2000 // 2 seconds MAX - you'll be angry otherwise! 😡

function getCachedAvatar(username: string): string | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + username)
    if (!cached) return null

    const data: CachedAvatar = JSON.parse(cached)
    const now = Date.now()

    // Check if cache is still valid (within 24 hours)
    if (now - data.timestamp < CACHE_DURATION) {
      console.log(`[Cache HIT] ⚡ Instant load for ${username}`)
      return data.url
    } else {
      // Cache expired, remove it
      localStorage.removeItem(CACHE_KEY_PREFIX + username)
      console.log(`[Cache EXPIRED] 🕐 Removed old cache for ${username}`)
      return null
    }
  } catch (error) {
    console.error("[Cache ERROR]", error)
    return null
  }
}

function setCachedAvatar(username: string, url: string): void {
  try {
    const data: CachedAvatar = {
      url,
      timestamp: Date.now()
    }
    localStorage.setItem(CACHE_KEY_PREFIX + username, JSON.stringify(data))
    console.log(`[Cache SAVED] 💾 Cached avatar for ${username}`)
  } catch (error) {
    // If localStorage is full, clear old caches
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn("[Cache FULL] 🗑️ Clearing old caches...")
      clearOldCaches()
      try {
        const data: CachedAvatar = { url, timestamp: Date.now() }
        localStorage.setItem(CACHE_KEY_PREFIX + username, JSON.stringify(data))
      } catch (e) {
        console.error("[Cache ERROR] Failed to save even after clearing:", e)
      }
    }
  }
}

function clearOldCaches(): void {
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(CACHE_KEY_PREFIX)) {
      try {
        const cached = localStorage.getItem(key)
        if (cached) {
          const data: CachedAvatar = JSON.parse(cached)
          const age = Date.now() - data.timestamp
          // Remove caches older than 12 hours when cleaning
          if (age > CACHE_DURATION / 2) {
            keysToRemove.push(key)
          }
        }
      } catch (e) {
        keysToRemove.push(key)
      }
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key))
  console.log(`[Cache CLEANUP] Removed ${keysToRemove.length} old entries`)
}

export function UserCard({ user, isNotFollowingBack = false, showProfileButton = false }: UserCardProps) {
  const [avatarUrl, setAvatarUrl] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false) // Changed to false initially
  const [error, setError] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [loadTime, setLoadTime] = useState<number>(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=gradient&color=fff&size=100&fontSize=0.33&bold=true&format=svg`

  // Set fallback immediately to avoid blank state
  useEffect(() => {
    setAvatarUrl(fallbackUrl)
  }, [fallbackUrl])

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: "100px", // Increased from 50px to load earlier
      }
    )

    if (cardRef.current) {
      observer.observe(cardRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!isVisible) return

    const fetchProfilePicture = async () => {
      const startTime = Date.now()
      
      try {
        // 1. CHECK CACHE FIRST (INSTANT! ⚡)
        const cachedUrl = getCachedAvatar(user.username)
        if (cachedUrl) {
          setAvatarUrl(cachedUrl)
          setIsLoading(false)
          setLoadTime(Date.now() - startTime)
          console.log(`[Cache HIT] ⚡ ${user.username} loaded instantly`)
          return // EXIT EARLY - No API call needed!
        }

        // 2. Show loading indicator briefly
        setIsLoading(true)
        setError(false)

        // 3. FETCH FROM API WITH STRICT 2 SECOND TIMEOUT 😡
        abortControllerRef.current = new AbortController()
        
        const timeoutId = setTimeout(() => {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            console.warn(`[TIMEOUT] 😡 ${user.username} took too long! Keeping fallback.`)
          }
        }, FETCH_TIMEOUT)

        try {
          const response = await fetch(
            `/api/instagram-profile?username=${encodeURIComponent(user.username)}`,
            {
              signal: abortControllerRef.current.signal,
              cache: 'no-store',
              priority: 'low', // Don't block other requests
            }
          )

          clearTimeout(timeoutId)

          if (response.ok) {
            const data = await response.json()
            if (data.profilePicUrl) {
              // SUCCESS! Save to cache and update
              setAvatarUrl(data.profilePicUrl)
              setCachedAvatar(user.username, data.profilePicUrl)
              setLoadTime(Date.now() - startTime)
              console.log(`[API SUCCESS] ✓ Loaded ${user.username} in ${Date.now() - startTime}ms`)
              return
            }
          }

          // Response not OK, keep fallback
          console.warn(`[API FAILED] ✗ ${response.status} for ${user.username} - using fallback`)
          // Don't cache fallback URLs
          
        } catch (fetchError: any) {
          clearTimeout(timeoutId)
          
          if (fetchError.name === 'AbortError') {
            // Timeout occurred - keep fallback
            console.error(`[TIMEOUT] 😡 ${user.username} exceeded 2 seconds - using fallback`)
          } else {
            throw fetchError
          }
        }

      } catch (err) {
        console.error(`[ERROR] 💥 Error fetching ${user.username}:`, err)
        setError(true)
        // Keep fallback avatar
      } finally {
        setIsLoading(false)
        const totalTime = Date.now() - startTime
        setLoadTime(totalTime)
        
        if (totalTime > FETCH_TIMEOUT) {
          console.error(`[SLOW LOAD] 😡 ${user.username} took ${totalTime}ms (max allowed: ${FETCH_TIMEOUT}ms)`)
        }
      }
    }

    // Add small delay to stagger requests (prevents rate limiting)
    const randomDelay = Math.random() * 200 // 0-200ms random delay
    const timer = setTimeout(fetchProfilePicture, randomDelay)

    // Cleanup
    return () => {
      clearTimeout(timer)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [user.username, isVisible, fallbackUrl])

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return ""
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <div
      ref={cardRef}
      className={`bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${
        isNotFollowingBack ? "border-destructive/50" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="relative">
          {/* Always show avatar immediately */}
          <img
            src={avatarUrl}
            alt={user.username}
            className={`w-12 h-12 rounded-full object-cover transition-opacity duration-300 ${
              isLoading ? "opacity-60" : "opacity-100"
            }`}
            loading="lazy"
            onError={() => {
              // If image fails to load, keep fallback
              console.warn(`[IMG ERROR] ${user.username} - fallback already set`)
            }}
          />
          
          {/* Tiny loading spinner overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/5 rounded-full">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          
          {/* Show load time badge if it took longer than 1s (for debugging) */}
          {loadTime > 1000 && loadTime <= FETCH_TIMEOUT && (
            <span className="absolute -bottom-1 -right-1 bg-yellow-500 text-white text-[10px] px-1 rounded-full">
              {(loadTime / 1000).toFixed(1)}s
            </span>
          )}
          {/* Show angry emoji if timeout occurred 😡 */}
          {loadTime > FETCH_TIMEOUT && (
            <span className="absolute -bottom-1 -right-1 bg-red-500 text-white text-[10px] px-1 rounded-full">
              😡
            </span>
          )}
        </div>
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
