import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";

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
  title: "HexCarb Console",
  description: "Web console for the HexCarb AI engine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh bg-zinc-50 text-zinc-950 antialiased`}
      >
        <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              HexCarb Console
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              <Link
                href="/panel/chat"
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Chat
              </Link>
              <Link
                href="/panel/system_status"
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Status
              </Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="border-t border-zinc-200 bg-white">
          <div className="mx-auto w-full max-w-6xl px-5 py-6 text-xs text-zinc-500">
            Powered by Next.js + a server-side proxy to the HexCarb FastAPI gateway.
          </div>
        </footer>
      </body>
    </html>
  );
}
