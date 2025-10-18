import { type NextRequest, NextResponse } from "next/server"

// Simple in-memory cache to avoid rate limiting
const profileCache = new Map<string, { url: string; timestamp: number }>()
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

async function getUserIdFromUsername(username: string): Promise<string | null> {
  try {
    const response = await fetch(`https://www.instagram.com/${username}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })

    if (!response.ok) return null

    const html = await response.text()
    // Extract user ID from the HTML response
    const match = html.match(/"id":"(\d+)"/)
    return match ? match[1] : null
  } catch (error) {
    console.error("[v0] Error getting user ID:", error)
    return null
  }
}

async function getProfilePictureFromPublicAPI(username: string): Promise<string | null> {
  try {
    // Method 1: Try web_profile_info endpoint
    const response = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    })

    if (response.ok) {
      const data = await response.json()
      const profilePicUrl = data.data?.user?.profile_pic_url_hd || data.data?.user?.profile_pic_url
      if (profilePicUrl) return profilePicUrl
    }

    // Method 2: Get user ID and fetch from info endpoint
    const userId = await getUserIdFromUsername(username)
    if (userId) {
      const infoResponse = await fetch(`https://i.instagram.com/api/v1/users/${userId}/info/`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      })

      if (infoResponse.ok) {
        const infoData = await infoResponse.json()
        const profilePicUrl =
          infoData.user?.hd_profile_pic_url_info?.url ||
          infoData.user?.profile_pic_url_hd ||
          infoData.user?.profile_pic_url

        if (profilePicUrl) return profilePicUrl
      }
    }

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

  try {
    const cached = profileCache.get(username)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({ profilePicUrl: cached.url })
    }

    const profilePicUrl = await getProfilePictureFromPublicAPI(username)

    if (profilePicUrl) {
      profileCache.set(username, { url: profilePicUrl, timestamp: Date.now() })
      return NextResponse.json({ profilePicUrl })
    }

    return NextResponse.json({ error: "Profile picture not found", profilePicUrl: null }, { status: 404 })
  } catch (error) {
    console.error("[v0] Unexpected error:", error)
    return NextResponse.json({ error: "Failed to fetch profile picture" }, { status: 500 })
  }
}
