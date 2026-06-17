import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EcomTools — E-commerce Growth Platform",
  description:
    "Find winning products, analyze competitors, track sales, and scale your store from one powerful dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-200 bg-white px-4 py-4 text-center text-sm text-gray-600">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3">
            <span>© {new Date().getFullYear()} ecomtool</span>
            <span className="text-gray-300">|</span>
            <Link href="/privacy-policy" className="font-medium text-brand hover:underline">
              Privacy Policy
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/terms-of-service" className="font-medium text-brand hover:underline">
              Terms of Service
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
