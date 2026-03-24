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
  title: "AgentReady — Is Your Store Ready for AI Shopping Agents?",
  description:
    "Scan your e-commerce store and find out if AI shopping agents can discover, understand, and buy your products. Free instant analysis.",
  openGraph: {
    title: "AgentReady — AI Agent Readiness Scanner",
    description:
      "Can AI shopping agents buy from your store? Find out in 10 seconds.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
