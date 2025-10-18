import { type NextRequest, NextResponse } from "next/server"

// Image proxy to bypass CORS restrictions
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const imageUrl = searchParams.get("url")

    if (!imageUrl) {
      return NextResponse.json({ error: "Missing image URL" }, { status: 400 })
    }

    // Decode the URL
    const decodedUrl = decodeURIComponent(imageUrl)

    console.log(`[Image Proxy] Fetching: ${decodedUrl.substring(0, 100)}...`)

    // Fetch the image with proper headers to mimic browser request
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const response = await fetch(decodedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.instagram.com/",
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`[Image Proxy] Failed to fetch image: ${response.status}`)
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: response.status }
      )
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get("content-type") || "image/jpeg"

    console.log(`[Image Proxy] ✓ Success! Size: ${imageBuffer.byteLength} bytes`)

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable", // Cache for 24 hours
        "Access-Control-Allow-Origin": "*", // Allow from any origin
      },
    })
  } catch (error: any) {
    console.error("[Image Proxy] Error:", error)
    
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: "Request timeout" }, { status: 504 })
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
