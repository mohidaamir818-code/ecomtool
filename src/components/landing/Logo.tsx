export function LogoIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="logoGradient" x1="4" y1="4" x2="28" y2="28">
          <stop stopColor="#5842F4" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <path
        d="M8 12h16l-1.8 14H9.8L8 12z"
        fill="url(#logoGradient)"
      />
      <path
        d="M11 10c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v2H11v-2z"
        fill="url(#logoGradient)"
      />
      <path
        d="M12 8.5C12 7.12 13.12 6 14.5 6h3C18.88 6 20 7.12 20 8.5"
        stroke="url(#logoGradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fill="white"
        fontSize="9"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        e
      </text>
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon />
      <span className="text-[1.35rem] font-bold tracking-tight text-[#111827]">
        EcomTools
      </span>
    </div>
  );
}
