import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  "ae01.alicdn.com",
  "ae02.alicdn.com",
  "ae03.alicdn.com",
  "ae04.alicdn.com",
  "ae-pic-a1.aliexpress-media.com",
  "ae-pic-a2.aliexpress-media.com",
  "img.alicdn.com",
  "sc04.alicdn.com",
  "sc05.alicdn.com",
];

function isAllowedImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    return ALLOWED_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(".alicdn.com") || url.hostname.endsWith(".aliexpress-media.com"),
    );
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url")?.trim();

  if (!rawUrl) {
    return NextResponse.json({ error: "url is required." }, { status: 400 });
  }

  const normalized = rawUrl.replace(/^\/\//, "https://");

  if (!isAllowedImageUrl(normalized)) {
    return NextResponse.json({ error: "Image host not allowed." }, { status: 403 });
  }

  try {
    const response = await fetch(normalized, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.aliexpress.com/",
      },
      cache: "force-cache",
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch image." }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image proxy failed." }, { status: 502 });
  }
}
