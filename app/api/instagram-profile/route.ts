import { type NextRequest, NextResponse } from "next/server"

// Simple in-memory cache to avoid rate limiting
const profileCache = new Map<string, { url: string; timestamp: number }>()
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

// Rotating User Agents to avoid detection
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
]

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

// Optimized timing constants for SPEED ⚡
const MAX_RETRIES_HTML = 2  // Fast retry
const MAX_RETRIES_API = 1   // Single retry only
const INITIAL_BACKOFF = 400 // Faster backoff (reduced from 1000ms)
const REQUEST_TIMEOUT = 4000 // Strict 4 second timeout (reduced from 15s)

// Helper function to decode HTML entities and clean URLs
function decodeUrl(url: string): string {
  if (!url) return url
  
  return url
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\\u0026/g, '&')
    .replace(/\\/g, '')
}

// Helper function to add delay
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function getProfilePictureFromHTML(username: string, retryCount = 0): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
    
    const response = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      signal: controller.signal,
      next: { revalidate: 3600 }, // Cache for 1 hour
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`[Instagram API] HTTP ${response.status} for ${username}`)
      
      // Fast retry on rate limit or service unavailable
      if ((response.status === 429 || response.status === 503) && retryCount < MAX_RETRIES_HTML) {
        const waitTime = INITIAL_BACKOFF * Math.pow(1.5, retryCount) // Faster backoff
        console.log(`[Instagram API] Retrying after ${waitTime}ms (attempt ${retryCount + 1}/${MAX_RETRIES_HTML})`)
        await delay(waitTime)
        return getProfilePictureFromHTML(username, retryCount + 1)
      }
      
      return null
    }

    const html = await response.text()

    // Method 1: Extract from meta tags (og:image)
    const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/)
    if (ogImageMatch && ogImageMatch[1]) {
      console.log(`[Instagram API] Found via og:image for ${username}`)
      return decodeUrl(ogImageMatch[1])
    }

    // Method 2: Extract from shared data JSON
    const sharedDataMatch = html.match(/<script type="text\/javascript">window\._sharedData = (.+?);<\/script>/)
    if (sharedDataMatch && sharedDataMatch[1]) {
      try {
        const sharedData = JSON.parse(sharedDataMatch[1])
        const profilePicUrl = 
          sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user?.profile_pic_url_hd ||
          sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user?.profile_pic_url
        if (profilePicUrl) {
          console.log(`[Instagram API] Found via sharedData for ${username}`)
          return decodeUrl(profilePicUrl)
        }
      } catch (e) {
        console.error("[Instagram API] Error parsing shared data:", e)
      }
    }

    // Method 3: Extract from profile_pic_url pattern
    const profilePicMatch = html.match(/"profile_pic_url_hd":"([^"]+)"/) || 
                           html.match(/"profile_pic_url":"([^"]+)"/)
    if (profilePicMatch && profilePicMatch[1]) {
      console.log(`[Instagram API] Found via profile_pic_url pattern for ${username}`)
      return decodeUrl(profilePicMatch[1])
    }

    // Method 4: Search for any Instagram CDN image URLs
    const cdnMatch = html.match(/https:\/\/[^"]*\.cdninstagram\.com\/[^"]*\/[^"]*\.(jpg|png|jpeg)/i)
    if (cdnMatch && cdnMatch[0]) {
      console.log(`[Instagram API] Found via CDN pattern for ${username}`)
      return decodeUrl(cdnMatch[0])
    }

    console.log(`[Instagram API] No profile picture found in HTML for ${username}`)
    return null
  } catch (error: any) {
    console.error("[Instagram API] Error fetching profile picture from HTML:", error)
    
    // Fast retry on network errors or timeouts
    if (retryCount < MAX_RETRIES_HTML && error?.name !== 'AbortError') {
      const waitTime = INITIAL_BACKOFF * Math.pow(1.5, retryCount)
      console.log(`[Instagram API] Retrying after error ${waitTime}ms (attempt ${retryCount + 1}/${MAX_RETRIES_HTML})`)
      await delay(waitTime)
      return getProfilePictureFromHTML(username, retryCount + 1)
    }
    
    return null
  }
}

async function getProfilePictureFromAPI(username: string, retryCount = 0): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
    
    // Try the web_profile_info endpoint with proper headers
    const response = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "X-IG-App-ID": "936619743392459",
        "X-ASBD-ID": "129477",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": `https://www.instagram.com/${username}/`,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
      },
      signal: controller.signal,
      next: { revalidate: 3600 },
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      const profilePicUrl = data.data?.user?.profile_pic_url_hd || data.data?.user?.profile_pic_url
      if (profilePicUrl) {
        console.log(`[Instagram API] Found via API endpoint for ${username}`)
        return decodeUrl(profilePicUrl)
      }
    } else {
      console.error(`[Instagram API] API returned ${response.status} for ${username}`)
      
      // Fast retry on rate limit
      if (response.status === 429 && retryCount < MAX_RETRIES_API) {
        const waitTime = INITIAL_BACKOFF * Math.pow(1.5, retryCount)
        console.log(`[Instagram API] API retry after ${waitTime}ms`)
        await delay(waitTime)
        return getProfilePictureFromAPI(username, retryCount + 1)
      }
    }

    return null
  } catch (error: any) {
    console.error("[Instagram API] Error fetching from API:", error)
    
    if (retryCount < MAX_RETRIES_API && error?.name !== 'AbortError') {
      const waitTime = INITIAL_BACKOFF * Math.pow(1.5, retryCount)
      await delay(waitTime)
      return getProfilePictureFromAPI(username, retryCount + 1)
    }
    
    return null
  }
}

// Fallback: Use third-party service (only as last resort)
async function getProfilePictureFromThirdParty(username: string): Promise<string | null> {
  try {
    // This is a fallback using Instagram's public endpoint
    // Note: This might not always work but provides an additional fallback
    const response = await fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Accept": "application/json",
      },
      next: { revalidate: 3600 },
    })

    if (response.ok) {
      const data = await response.json()
      const profilePicUrl = data.data?.user?.profile_pic_url_hd || data.data?.user?.profile_pic_url
      if (profilePicUrl) {
        console.log(`[Instagram API] Found via third-party endpoint for ${username}`)
        return decodeUrl(profilePicUrl)
      }
    }
  } catch (error) {
    console.error("[Instagram API] Third-party fallback failed:", error)
  }
  
  return null
}

async function getProfilePictureFromPublicAPI(username: string): Promise<string | null> {
  try {
    console.log(`[Instagram API] Starting fetch for ${username}`)
    
    // Method 1: Try HTML scraping first (most reliable)
    console.log(`[Instagram API] Trying HTML scraping for ${username}`)
    let profilePicUrl = await getProfilePictureFromHTML(username)
    if (profilePicUrl) {
      console.log(`[Instagram API] ✓ Found via HTML scraping`)
      return profilePicUrl
    }

    // Small delay between methods to avoid rate limiting
    await delay(500)

    // Method 2: Try API endpoint
    console.log(`[Instagram API] Trying API endpoint for ${username}`)
    profilePicUrl = await getProfilePictureFromAPI(username)
    if (profilePicUrl) {
      console.log(`[Instagram API] ✓ Found via API`)
      return profilePicUrl
    }

    // Small delay before fallback
    await delay(500)

    // Method 3: Try third-party fallback
    console.log(`[Instagram API] Trying third-party fallback for ${username}`)
    profilePicUrl = await getProfilePictureFromThirdParty(username)
    if (profilePicUrl) {
      console.log(`[Instagram API] ✓ Found via third-party`)
      return profilePicUrl
    }

    console.log(`[Instagram API] ✗ All methods failed for ${username}`)
    return null
  } catch (error) {
    console.error("[Instagram API] Unexpected error in getProfilePictureFromPublicAPI:", error)
    return null
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get("username")

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 })
  }

  // Validate username format
  if (!/^[a-zA-Z0-9._]+$/.test(username)) {
    return NextResponse.json({ error: "Invalid username format" }, { status: 400 })
  }

  try {
    // Check cache first
    const cached = profileCache.get(username)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`[Instagram API] ✓ Returning cached result for ${username}`)
      // Wrap cached URL with proxy
      const proxiedUrl = `/api/proxy-image?url=${encodeURIComponent(cached.url)}`
      return NextResponse.json({ 
        profilePicUrl: proxiedUrl,
        originalUrl: cached.url,
        cached: true 
      })
    }

    console.log(`[Instagram API] Fetching profile picture for ${username}`)
    
    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 15000) // 15 second timeout
    )
    
    const fetchPromise = getProfilePictureFromPublicAPI(username)
    
    const profilePicUrl = await Promise.race([fetchPromise, timeoutPromise])

    if (profilePicUrl) {
      // Wrap the Instagram CDN URL with our proxy to bypass CORS
      const proxiedUrl = `/api/proxy-image?url=${encodeURIComponent(profilePicUrl)}`
      
      // Cache the successful result (cache the original URL, not proxied)
      profileCache.set(username, { url: profilePicUrl, timestamp: Date.now() })
      console.log(`[Instagram API] ✓ Successfully fetched and cached profile picture for ${username}`)
      
      return NextResponse.json({ 
        profilePicUrl: proxiedUrl, // Return proxied URL to bypass CORS
        originalUrl: profilePicUrl, // Keep original for reference
        cached: false 
      })
    }

    // Return 404 but with more specific error
    console.log(`[Instagram API] ✗ Profile picture not found for ${username}`)
    return NextResponse.json(
      { 
        error: "Profile picture not found", 
        profilePicUrl: null,
        message: "The profile may be private, doesn't exist, or Instagram is blocking our requests. Try again later."
      }, 
      { status: 404 }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Instagram API] ✗ Unexpected error:", errorMessage)
    
    // Don't return 500 for timeout, return 404 instead
    if (errorMessage.includes('timeout')) {
      return NextResponse.json(
        { 
          error: "Request timeout", 
          profilePicUrl: null,
          message: "Instagram took too long to respond. Please try again."
        }, 
        { status: 408 } // Request Timeout
      )
    }
    
    return NextResponse.json(
      { 
        error: "Failed to fetch profile picture", 
        profilePicUrl: null,
        details: errorMessage
      }, 
      { status: 500 }
    )
  }
}
