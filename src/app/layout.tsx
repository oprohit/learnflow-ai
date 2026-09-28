import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { getUser } from "@/lib/auth";
import NativeBridge from "@/components/NativeBridge";
import "./globals.css";

export const metadata: Metadata = {
  title: "LearnFlow AI — Your material. Your language. Your way of learning.",
  description: "Upload your learning material and let AI turn it into a personal teacher that adapts to your language and pace.",
  applicationName: "LearnFlow AI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B0B1E",
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getUser().catch(() => null);
  const a = user?.accessibility ?? {};
  const cls = [a.largeText && "a11y-large", a.highContrast && "a11y-contrast", a.reducedMotion && "a11y-reduced"].filter(Boolean).join(" ");
  return (
    <html lang={user?.primaryLanguage ?? "en"} className={cls}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-dvh antialiased">
        <NativeBridge />
        {children}
      </body>
    </html>
  );
}
