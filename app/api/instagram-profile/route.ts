import { type NextRequest, NextResponse } from "next/server"

// Simple in-memory cache to avoid rate limiting
const profileCache = new Map<string, { url: string; timestamp: number }>()
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

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

async function getProfilePictureFromHTML(username: string): Promise<string | null> {
  try {
    const response = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Cache-Control": "max-age=0",
      },
    })

    if (!response.ok) {
      console.error(`[v0] HTTP ${response.status} for ${username}`)
      return null
    }

    const html = await response.text()

    // Method 1: Extract from meta tags (og:image)
    const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/)
    if (ogImageMatch && ogImageMatch[1]) {
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
        if (profilePicUrl) return decodeUrl(profilePicUrl)
      } catch (e) {
        console.error("[v0] Error parsing shared data:", e)
      }
    }

    // Method 3: Extract from profile_pic_url pattern
    const profilePicMatch = html.match(/"profile_pic_url_hd":"([^"]+)"/) || 
                           html.match(/"profile_pic_url":"([^"]+)"/)
    if (profilePicMatch && profilePicMatch[1]) {
      return decodeUrl(profilePicMatch[1])
    }

    // Method 4: Search for any Instagram CDN image URLs
    const cdnMatch = html.match(/https:\/\/[^"]*\.cdninstagram\.com\/[^"]*\/[^"]*\.(jpg|png|jpeg)/i)
    if (cdnMatch && cdnMatch[0]) {
      return decodeUrl(cdnMatch[0])
    }

    return null
  } catch (error) {
    console.error("[v0] Error fetching profile picture from HTML:", error)
    return null
  }
}

async function getProfilePictureFromAPI(username: string): Promise<string | null> {
  try {
    // Try the web_profile_info endpoint with proper headers
    const response = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "X-IG-App-ID": "936619743392459",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": `https://www.instagram.com/${username}/`,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
      },
    })

    if (response.ok) {
      const data = await response.json()
      const profilePicUrl = data.data?.user?.profile_pic_url_hd || data.data?.user?.profile_pic_url
      if (profilePicUrl) return decodeUrl(profilePicUrl)
    }

    return null
  } catch (error) {
    console.error("[v0] Error fetching from API:", error)
    return null
  }
}

async function getProfilePictureFromPublicAPI(username: string): Promise<string | null> {
  try {
    // Method 1: Try HTML scraping first (most reliable)
    console.log(`[v0] Trying HTML scraping for ${username}`)
    let profilePicUrl = await getProfilePictureFromHTML(username)
    if (profilePicUrl) {
      console.log(`[v0] Found via HTML scraping`)
      return profilePicUrl
    }

    // Method 2: Try API endpoint
    console.log(`[v0] Trying API endpoint for ${username}`)
    profilePicUrl = await getProfilePictureFromAPI(username)
    if (profilePicUrl) {
      console.log(`[v0] Found via API`)
      return profilePicUrl
    }

    console.log(`[v0] All methods failed for ${username}`)
    return null
  } catch (error) {
    console.error("[v0] Error fetching profile picture:", error)
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
    // Check cache
    const cached = profileCache.get(username)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`[v0] Returning cached result for ${username}`)
      return NextResponse.json({ profilePicUrl: cached.url })
    }

    console.log(`[v0] Fetching profile picture for ${username}`)
    const profilePicUrl = await getProfilePictureFromPublicAPI(username)

    if (profilePicUrl) {
      // Cache the result
      profileCache.set(username, { url: profilePicUrl, timestamp: Date.now() })
      console.log(`[v0] Successfully fetched profile picture for ${username}`)
      return NextResponse.json({ profilePicUrl })
    }

    console.log(`[v0] Profile picture not found for ${username}`)
    return NextResponse.json(
      { 
        error: "Profile picture not found. The profile may be private or the username may not exist.", 
        profilePicUrl: null 
      }, 
      { status: 404 }
    )
  } catch (error) {
    console.error("[v0] Unexpected error:", error)
    return NextResponse.json(
      { 
        error: "Failed to fetch profile picture. Please try again later.", 
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}
