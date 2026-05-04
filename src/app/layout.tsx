import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { APP_NAME } from "@/lib/config";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} — End-to-End Encrypted Messaging`,
  description:
    "SilentKey is a secure messaging app where encryption and decryption happen entirely on your device. The server only ever stores ciphertext.",
  keywords: [
    "encrypted messaging",
    "end-to-end encryption",
    "secure chat",
    "private messaging",
    "Web Crypto API",
  ],
  openGraph: {
    title: `${APP_NAME} — End-to-End Encrypted Messaging`,
    description:
      "Messages only you can read. Powered by AES-GCM, RSA-OAEP, and the Web Crypto API.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-background text-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
