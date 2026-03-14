import type { Metadata } from "next";
import { Sora, Public_Sans } from "next/font/google";
import "./globals.css";
import AppShell from "./AppShell";

const sora = Sora({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const publicSans = Public_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HexCarb AI Console",
  description: "Command center for the HexCarb AI engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sora.variable} ${publicSans.variable} min-h-dvh antialiased`}
        style={{
          fontFamily: "var(--font-body), system-ui, sans-serif",
          background: "var(--hc-page-bg)",
          color: "var(--hc-text)",
        }}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
