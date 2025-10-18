import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get("username")

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 })
  }

  try {
    // Using Instagram's public API endpoint
    const response = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const data = await response.json()
    const profilePicUrl = data.data?.user?.profile_pic_url_hd || data.data?.user?.profile_pic_url

    return NextResponse.json({ profilePicUrl })
  } catch (error) {
    console.error("Error fetching Instagram profile:", error)
    return NextResponse.json({ error: "Failed to fetch profile picture" }, { status: 500 })
  }
}
