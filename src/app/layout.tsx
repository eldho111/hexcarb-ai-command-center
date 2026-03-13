import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

import "./globals.css";
import { AppShell } from "./AppShell";

const hexSans = Space_Grotesk({
  variable: "--font-hex-sans",
  subsets: ["latin"],
  display: "swap",
});

const hexMono = JetBrains_Mono({
  variable: "--font-hex-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HexCarb Command Center",
  description: "Premium console for HexCarb's AI engine.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${hexSans.variable} ${hexMono.variable} antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
