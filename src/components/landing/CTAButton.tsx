import Link from "next/link";

type CTAButtonProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M3.75 9h10.5M9.75 4.5L14.25 9l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const sizeClasses = {
  sm: "px-4 py-2 text-sm rounded-lg",
  md: "px-6 py-3 text-[15px] rounded-xl",
  lg: "px-7 py-3.5 text-base rounded-xl",
};

export function CTAButton({
  href = "/sign-up",
  size = "md",
  className = "",
}: CTAButtonProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 bg-brand font-semibold text-white shadow-[0_8px_24px_rgba(88,66,244,0.35)] transition-all hover:bg-brand-dark hover:shadow-[0_8px_28px_rgba(88,66,244,0.45)] ${sizeClasses[size]} ${className}`}
    >
      Start your free trial
      <ArrowIcon />
    </Link>
  );
}
