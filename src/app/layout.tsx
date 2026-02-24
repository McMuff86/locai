import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../components/ThemeProvider";
import { Toaster } from "../components/ui/toaster";
import { ClientErrorBoundary } from "../components/ClientErrorBoundary";
import { FontSizeSync } from "../components/FontSizeSync";

export const metadata: Metadata = {
  title: 'LocAI',
  description: 'Your AI, Locked and Loaded - Future Unleashed on Bare Metal',
  metadataBase: new URL('http://localhost:3000'),
  openGraph: {
    title: 'LocAI',
    description: 'Your AI, Locked and Loaded - Future Unleashed on Bare Metal',
    type: 'website',
  },
  icons: { icon: '/favicon.ico' },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <FontSizeSync />
          <ClientErrorBoundary>
            {children}
          </ClientErrorBoundary>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
