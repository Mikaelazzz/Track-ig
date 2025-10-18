import { type NextRequest, NextResponse } from "next/server"

// Simple in-memory cache
const profileCache = new Map<string, { url: string; timestamp: number }>()
const CACHE_DURATION = 24 * 60 * 60 * 1000

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
]

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function decodeUrl(url: string): string {
  return url?.replace(/&amp;/g, '&').replace(/\\/g, '') || url
}

async function getInstagramUserID(username: string): Promise<string | null> {
  try {
    console.log(`[Step 1] Getting User ID for: ${username}`)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    
    const response = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    
    console.log(`[Step 1] HTTP Status: ${response.status}`)
    
    if (!response.ok) {
      console.error(`[Step 1] Failed with status ${response.status}`)
      return null
    }
    
    const html = await response.text()
    console.log(`[Step 1] HTML length: ${html.length} chars`)
    
    const match = html.match(/"id":"(\d+)"/)
    if (match?.[1]) {
      console.log(`[Step 1] ✓ Found User ID: ${match[1]}`)
      return match[1]
    }
    
    console.error(`[Step 1] Could not extract User ID from HTML`)
    return null
  } catch (error: any) {
    console.error(`[Step 1] Error:`, error.message || error)
    return null
  }
}

async function getHDProfilePicByUserID(userid: string): Promise<string | null> {
  try {
    console.log(`[Step 2] Getting profile pic for User ID: ${userid}`)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    
    const response = await fetch(`https://i.instagram.com/api/v1/users/${userid}/info/`, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "X-IG-App-ID": "936619743392459",
        "X-ASBD-ID": "129477",
        "X-Requested-With": "XMLHttpRequest",
      },
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    
    console.log(`[Step 2] HTTP Status: ${response.status}`)
    
    if (!response.ok) {
      console.error(`[Step 2] Failed with status ${response.status}`)
      return null
    }
    
    const data = await response.json()
    const picUrl = data.user?.hd_profile_pic_url_info?.url || data.user?.profile_pic_url
    
    if (picUrl) {
      console.log(`[Step 2] ✓ Found profile picture`)
      return picUrl
    }
    
    console.error(`[Step 2] No profile picture in response`)
    return null
  } catch (error: any) {
    console.error(`[Step 2] Error:`, error.message || error)
    return null
  }
}

export async function GET(request: NextRequest) {
  const username = new URL(request.url).searchParams.get("username")
  
  console.log(`[API] === Request for username: ${username} ===`)
  
  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 })
  }

  // Check cache first
  const cached = profileCache.get(username)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`[API] ✓ Cache HIT for ${username}`)
    return NextResponse.json({ 
      profilePicUrl: `/api/proxy-image?url=${encodeURIComponent(cached.url)}`, 
      cached: true 
    })
  }

  console.log(`[API] Cache MISS - Fetching from Instagram...`)

  // Step 1: Get User ID
  const userid = await getInstagramUserID(username)
  if (!userid) {
    console.error(`[API] ✗ Failed to get User ID for ${username}`)
    return NextResponse.json({ 
      error: "User not found",
      message: "Could not retrieve Instagram user ID. User may not exist or Instagram is blocking the request."
    }, { status: 404 })
  }

  // Step 2: Get Profile Picture
  const pic = await getHDProfilePicByUserID(userid)
  if (!pic) {
    console.error(`[API] ✗ Failed to get profile picture for ${username}`)
    return NextResponse.json({ 
      error: "Profile pic not found",
      message: "User ID found but could not retrieve profile picture. Profile may be private."
    }, { status: 404 })
  }

  // Success!
  const cleaned = decodeUrl(pic)
  profileCache.set(username, { url: cleaned, timestamp: Date.now() })
  
  console.log(`[API] ✓ SUCCESS for ${username}`)
  
  return NextResponse.json({ 
    profilePicUrl: `/api/proxy-image?url=${encodeURIComponent(cleaned)}`,
    cached: false
  })
}
