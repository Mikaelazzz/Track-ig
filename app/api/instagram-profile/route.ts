import { type NextRequest, NextResponse } from "next/server"

// Simple in-memory cache
const profileCache = new Map<string, { url: string; timestamp: number }>()
const CACHE_DURATION = 24 * 60 * 60 * 1000

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
]

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function decodeUrl(url: string): string {
  return url?.replace(/&amp;/g, '&').replace(/\\/g, '') || url
}

async function getInstagramUserID(username: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(`https://www.instagram.com/${username}/`, {
      headers: { "User-Agent": getRandomUserAgent() },
      signal: controller.signal
    })
    
    if (!response.ok) return null
    const html = await response.text()
    const match = html.match(/"id":"(\d+)"/)
    return match?.[1] || null
  } catch {
    return null
  }
}

async function getHDProfilePicByUserID(userid: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(`https://i.instagram.com/api/v1/users/${userid}/info/`, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "X-IG-App-ID": "936619743392459"
      },
      signal: controller.signal
    })
    
    if (!response.ok) return null
    const data = await response.json()
    return data.user?.hd_profile_pic_url_info?.url || data.user?.profile_pic_url || null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const username = new URL(request.url).searchParams.get("username")
  if (!username) return NextResponse.json({ error: "Username required" }, { status: 400 })

  const cached = profileCache.get(username)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json({ profilePicUrl: `/api/proxy-image?url=${encodeURIComponent(cached.url)}`, cached: true })
  }

  const userid = await getInstagramUserID(username)
  if (!userid) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const pic = await getHDProfilePicByUserID(userid)
  if (!pic) return NextResponse.json({ error: "Profile pic not found" }, { status: 404 })

  const cleaned = decodeUrl(pic)
  profileCache.set(username, { url: cleaned, timestamp: Date.now() })
  
  return NextResponse.json({ 
    profilePicUrl: `/api/proxy-image?url=${encodeURIComponent(cleaned)}`,
    cached: false
  })
}
