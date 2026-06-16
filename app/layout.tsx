import type { Metadata } from "next";
import Script from "next/script";

import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { THEME_STYLE_BLOCK } from "@/lib/theme-styles";

import "./globals.css";

export const metadata: Metadata = {
  title: "Counterpoint",
  description: "Private debate rooms for sharper arguments, elite rebuttals, and premium post-round analysis.",
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
          <SiteHeader />
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
