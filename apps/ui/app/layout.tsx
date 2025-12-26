import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Intellibooks Studio - AI-Powered Document Intelligence",
  description:
    "Transform your documents and audio with AI agents. Transcription, translation, summarization, RAG, and intelligent knowledge extraction.",
};

// Check if Clerk is properly configured (key must be valid format)
const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isValidClerkKey = clerkPubKey &&
  (clerkPubKey.startsWith('pk_live_') || clerkPubKey.startsWith('pk_test_')) &&
  clerkPubKey.length > 20 &&
  !clerkPubKey.includes('placeholder');

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );

  // Only wrap with ClerkProvider if the key is valid
  if (isValidClerkKey) {
    return <ClerkProvider>{content}</ClerkProvider>;
  }

  return content;
}
