import type { Metadata } from "next";
import Script from "next/script";

import ThemeToggle from "@/components/theme-toggle";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { THEME_STYLE_BLOCK } from "@/lib/theme-styles";

import "./globals.css";

export const metadata: Metadata = {
  title: "Debate Me",
  description: "Practice arguments, rebuttals, and tradeoff framing against an AI opponent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <style id="theme-overrides">{THEME_STYLE_BLOCK}</style>
        <div className="min-h-full">
          <div className="app-topbar relative z-40">
            <div className="mx-auto flex max-w-6xl justify-end px-6 pt-4 sm:px-8">
              <ThemeToggle />
            </div>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
