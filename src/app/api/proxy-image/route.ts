import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

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

async function stripImageMetadata(buffer: Buffer, contentType: string): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    const image = sharp(buffer, { failOn: "none" }).rotate();

    if (contentType.includes("png")) {
      return {
        buffer: await image.png().toBuffer(),
        contentType: "image/png",
      };
    }

    if (contentType.includes("webp")) {
      return {
        buffer: await image.webp().toBuffer(),
        contentType: "image/webp",
      };
    }

    if (contentType.includes("gif")) {
      return {
        buffer: await image.gif().toBuffer(),
        contentType: "image/gif",
      };
    }

    return {
      buffer: await image.jpeg({ quality: 90 }).toBuffer(),
      contentType: "image/jpeg",
    };
  } catch {
    return { buffer, contentType };
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
    const rawBuffer = Buffer.from(await response.arrayBuffer());
    const { buffer, contentType: outputType } = await stripImageMetadata(rawBuffer, contentType);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": outputType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image proxy failed." }, { status: 502 });
  }
}
