import type { Metadata } from "next";
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
  metadataBase: new URL("https://thewalletshift.com"),
  title: "The Wallet Shift — the on-chain agent economy scoreboard",
  description:
    "DeFiLlama for AI agents. Live ERC-8004 analytics on Ethereum mainnet: agent population, operator concentration, x402 payment support, and reputation.",
  // Discoverability for AI agents: advertise the agent skill (a fetchable
  // Markdown doc at /SKILL.md) as a machine-readable alternate of the site.
  alternates: {
    types: {
      "text/markdown": "/SKILL.md",
    },
  },
  openGraph: {
    title: "The Wallet Shift",
    description: "The live scoreboard for the on-chain agent economy.",
    url: "https://thewalletshift.com",
    siteName: "The Wallet Shift",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Wallet Shift",
    description: "The live scoreboard for the on-chain agent economy.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
