import type { Metadata, Viewport } from "next";
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
  title: "CIVITAS OS — Peradaban Nusantara Digital Otonom",
  description:
    "Sistem operasi peradaban otonom: Civilization Kernel otoritatif, pemerintahan multi-agen, warga villager Minecraft ber-LLM, guild kerja nyata (coding, dev, pembangunan, militer, engineer, miner), tool calling + internet nyata, server Bedrock lokal & online, dan dashboard bergaya Minecraft.",
  keywords: ["CIVITAS OS", "Minecraft civilization", "autonomous agents", "villager AI", "Bedrock server", "AI civilization", "Mulky Malikul Dhaher"],
  authors: [{ name: "Mulky Malikul Dhaher", url: "mailto:mulkymalikuldhr@mail.com" }],
  icons: { icon: [{ url: "/logo.svg", type: "image/svg+xml" }] },
};

export const viewport: Viewport = {
  themeColor: "#060a08",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        {/* Font pixel dunia Minecraft (React 19 meng-hoist <link> ke <head>) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet" />
        {children}
      </body>
    </html>
  );
}
