import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../components/ThemeProvider";
import { Toaster } from "../components/ui/toaster";
import { ClientErrorBoundary } from "../components/ClientErrorBoundary";
import { FontSizeSync } from "../components/FontSizeSync";

export const metadata = {
  title: 'LocAI',
  description: 'Your AI, Locked and Loaded - Future Unleashed on Bare Metal',
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
    <html lang="en" suppressHydrationWarning>
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
