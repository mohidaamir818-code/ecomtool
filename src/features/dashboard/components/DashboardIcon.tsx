"use client";

type IconName =
  | "grid" | "search" | "box" | "users" | "key" | "truck"
  | "list" | "code" | "chart" | "settings" | "help"
  | "send" | "clock" | "bell" | "calendar" | "crown";

const iconClass = "h-[18px] w-[18px]";

export function DashboardIcon({ name, className = iconClass }: { name: IconName; className?: string }) {
  switch (name) {
    case "grid":
      return (
        <svg className={className} viewBox="0 0 18 18" fill="currentColor" aria-hidden>
          <rect x="2" y="2" width="6" height="6" rx="1.5" />
          <rect x="10" y="2" width="6" height="6" rx="1.5" />
          <rect x="2" y="10" width="6" height="6" rx="1.5" />
          <rect x="10" y="10" width="6" height="6" rx="1.5" />
        </svg>
      );
    case "search":
      return (
        <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="8" cy="8" r="5" />
          <path d="M12 12l4 4" strokeLinecap="round" />
        </svg>
      );
    case "box":
      return (
        <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M3 6l6-3 6 3v8l-6 3-6-3V6z" strokeLinejoin="round" />
          <path d="M9 3v14M3 6l6 3 6-3" strokeLinejoin="round" />
        </svg>
      );
    case "users":
      return (
        <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="7" cy="6" r="3" />
          <path d="M2 16c0-3 2.2-5 5-5s5 2 5 5" strokeLinecap="round" />
          <circle cx="13" cy="7" r="2.5" />
          <path d="M15 16c0-2-1-3.5-2.5-4" strokeLinecap="round" />
        </svg>
      );
    case "key":
      return (
        <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="7" cy="11" r="4" />
          <path d="M10 8l5-5M13 3h3v3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "truck":
      return (
        <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M2 4h9v9H2zM11 7h3l2 3v3h-5V7z" strokeLinejoin="round" />
          <circle cx="5" cy="14" r="1.5" />
          <circle cx="14" cy="14" r="1.5" />
        </svg>
      );
    case "list":
      return (
        <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M3 5h12M3 9h12M3 13h8" strokeLinecap="round" />
        </svg>
      );
    case "code":
      return (
        <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M6 5L2 9l4 4M12 5l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "chart":
      return (
        <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M3 15V8M7 15V5M11 15V9M15 15V3" strokeLinecap="round" />
        </svg>
      );
    case "settings":
      return (
        <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="9" cy="9" r="2.5" />
          <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" strokeLinecap="round" />
        </svg>
      );
    case "help":
      return (
        <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="9" cy="9" r="7" />
          <path d="M7 7a2 2 0 114 0c0 2-2 2-2 4M9 14h.01" strokeLinecap="round" />
        </svg>
      );
    case "send":
      return (
        <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M2 9l14-6-6 14-2-6-6-2z" strokeLinejoin="round" />
        </svg>
      );
    case "clock":
      return (
        <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="9" cy="9" r="7" />
          <path d="M9 5v4l3 2" strokeLinecap="round" />
        </svg>
      );
    case "bell":
      return (
        <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M7 15a2 2 0 004 0M4 7a5 5 0 0110 0v4l2 2H2l2-2V7z" strokeLinejoin="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <rect x="2" y="4" width="14" height="12" rx="2" />
          <path d="M2 8h14M6 2v4M12 2v4" strokeLinecap="round" />
        </svg>
      );
    case "crown":
      return (
        <svg className={className} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M3 13h12v2H3zM3 13l2-8 4 4 4-4 2 8" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}
