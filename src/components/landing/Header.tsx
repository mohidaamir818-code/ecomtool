import Link from "next/link";
import { CTAButton } from "./CTAButton";
import { Logo } from "./Logo";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Resources", href: "#resources", hasChevron: true },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto grid h-[72px] max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center px-6 lg:px-10">
        <Link href="/" className="justify-self-start">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-9 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="flex items-center gap-1 text-[15px] font-medium text-[#374151] transition-colors hover:text-[#111827]"
            >
              {link.label}
              {link.hasChevron && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path
                    d="M3.5 5.25L7 8.75l3.5-3.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-self-end gap-5">
          <Link
            href="/sign-in"
            className="hidden text-[15px] font-medium text-[#374151] transition-colors hover:text-[#111827] sm:block"
          >
            Log in
          </Link>
          <CTAButton size="sm" />
        </div>
      </div>
    </header>
  );
}
