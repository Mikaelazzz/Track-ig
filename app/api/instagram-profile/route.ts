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

// Fallback 1: Use InstaDP (free Instagram scraper)
async function getProfilePictureFromInstaDP(username: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8s timeout

    // InstaDP provides free Instagram profile picture API
    const response = await fetch(`https://www.instadp.com/fullsize/${username}`, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const html = await response.text()
      
      // Try to extract high-quality image URL from HTML
      const match = html.match(/<img[^>]*src="([^"]*)"[^>]*class="[^"]*main-img[^"]*"/i) 
        || html.match(/og:image"[^>]*content="([^"]*)"/i)
        || html.match(/<img[^>]*src="(https:\/\/[^"]*cdninstagram[^"]*)"/i)
      
      if (match && match[1]) {
        const imageUrl = match[1]
        if (imageUrl.includes('cdninstagram.com') || imageUrl.includes('fbcdn.net')) {
          console.log(`[InstaDP] ✓ Found profile picture for ${username}`)
          return decodeUrl(imageUrl)
        }
      }
    }
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.error("[InstaDP] Error:", error)
    }
  }
  
  return null
}

// Fallback 2: Use Instafollowers (another reliable scraper)
async function getProfilePictureFromInstafollowers(username: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(`https://www.instafollowers.co/find-user-id?username=${username}`, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      if (data.profile_pic_url || data.profile_pic_url_hd) {
        const imageUrl = data.profile_pic_url_hd || data.profile_pic_url
        console.log(`[Instafollowers] ✓ Found profile picture for ${username}`)
        return decodeUrl(imageUrl)
      }
    }
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.error("[Instafollowers] Error:", error)
    }
  }
  
  return null
}

// Fallback 3: Use Picuki (Instagram viewer)
async function getProfilePictureFromPicuki(username: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(`https://www.picuki.com/profile/${username}`, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Accept": "text/html",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const html = await response.text()
      
      // Extract profile picture from Picuki HTML
      const match = html.match(/<img[^>]*class="[^"]*profile-pic[^"]*"[^>]*src="([^"]*)"/i)
        || html.match(/<div[^>]*class="[^"]*profile-avatar[^"]*"[^>]*style="[^"]*background-image:\s*url\('([^']*)'\)/i)
      
      if (match && match[1]) {
        const imageUrl = match[1]
        if (imageUrl.includes('cdninstagram.com') || imageUrl.includes('fbcdn.net')) {
          console.log(`[Picuki] ✓ Found profile picture for ${username}`)
          return decodeUrl(imageUrl)
        }
      }
    }
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.error("[Picuki] Error:", error)
    }
  }
  
  return null
}

// Fallback 4: Use direct Instagram i.instagram.com API
async function getProfilePictureFromThirdParty(username: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Accept": "application/json",
        "X-IG-App-ID": "936619743392459",
      },
      signal: controller.signal,
      next: { revalidate: 3600 },
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      const profilePicUrl = data.data?.user?.profile_pic_url_hd || data.data?.user?.profile_pic_url
      if (profilePicUrl) {
        console.log(`[i.instagram.com] ✓ Found profile picture for ${username}`)
        return decodeUrl(profilePicUrl)
      }
    }
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.error("[i.instagram.com] Error:", error)
    }
  }
  
  return null
}

async function getProfilePictureFromPublicAPI(username: string): Promise<string | null> {
  try {
    console.log(`[Instagram Scraper] 🚀 Starting multi-source fetch for ${username}`)
    
    // Try all methods in parallel for faster results!
    const methods = [
      { name: 'InstaDP', fn: () => getProfilePictureFromInstaDP(username) },
      { name: 'Instafollowers', fn: () => getProfilePictureFromInstafollowers(username) },
      { name: 'Picuki', fn: () => getProfilePictureFromPicuki(username) },
      { name: 'HTML Scraping', fn: () => getProfilePictureFromHTML(username) },
      { name: 'Instagram API', fn: () => getProfilePictureFromAPI(username) },
      { name: 'i.instagram.com', fn: () => getProfilePictureFromThirdParty(username) },
    ]

    // Try first 3 scrapers in parallel (fastest wins!)
    console.log(`[Instagram Scraper] 🏃 Racing 3 scrapers for ${username}...`)
    const firstBatch = await Promise.allSettled([
      getProfilePictureFromInstaDP(username),
      getProfilePictureFromInstafollowers(username),
      getProfilePictureFromPicuki(username),
    ])

    for (const result of firstBatch) {
      if (result.status === 'fulfilled' && result.value) {
        console.log(`[Instagram Scraper] ✓ SUCCESS! Got profile pic for ${username}`)
        return result.value
      }
    }

    // If first batch failed, try official Instagram methods
    console.log(`[Instagram Scraper] 🔄 Trying official Instagram endpoints for ${username}...`)
    
    let profilePicUrl = await getProfilePictureFromHTML(username)
    if (profilePicUrl) {
      console.log(`[Instagram Scraper] ✓ Found via HTML scraping`)
      return profilePicUrl
    }

    await delay(300) // Small delay

    profilePicUrl = await getProfilePictureFromAPI(username)
    if (profilePicUrl) {
      console.log(`[Instagram Scraper] ✓ Found via API`)
      return profilePicUrl
    }

    await delay(300)

    profilePicUrl = await getProfilePictureFromThirdParty(username)
    if (profilePicUrl) {
      console.log(`[Instagram Scraper] ✓ Found via i.instagram.com`)
      return profilePicUrl
    }

    console.log(`[Instagram Scraper] ✗ All methods failed for ${username}`)
    return null
  } catch (error) {
    console.error("[Instagram Scraper] Unexpected error:", error)
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
