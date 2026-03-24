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
  title: "CartParse | AI Shopping Agent Readiness Scanner",
  description: "Find out if AI shopping agents can discover and buy from your store. Free instant scan.",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "CartParse | Can AI Agents Buy From Your Store?",
    description: "Scan your e-commerce store and see what AI shopping agents actually see. Free instant analysis with fix code.",
    type: "website",
    siteName: "CartParse",
  },
  twitter: {
    card: "summary_large_image",
    title: "CartParse | AI Shopping Agent Readiness Scanner",
    description: "Can AI agents buy from your store? Find out in 10 seconds.",
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
