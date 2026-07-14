"use client";

interface ProxiedImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function proxyImageSrc(originalUrl: string): string {
  if (!originalUrl) return "";
  if (originalUrl.startsWith("/api/proxy-image")) return originalUrl;
  if (originalUrl.startsWith("blob:") || originalUrl.startsWith("data:")) return originalUrl;

  try {
    const host = new URL(originalUrl).hostname.toLowerCase();
    const needsProxy =
      host.includes("alicdn.com") ||
      host.includes("aliexpress-media.com") ||
      host.includes("aliexpress.com");
    if (!needsProxy) return originalUrl;
  } catch {
    return originalUrl;
  }

  return `/api/proxy-image?url=${encodeURIComponent(originalUrl)}`;
}

export function ProxiedImage({ src, alt, className }: ProxiedImageProps) {
  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={proxyImageSrc(src)} alt={alt} className={className} loading="lazy" />
  );
}
