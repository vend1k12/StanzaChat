import "./globals.css";

import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";

/**
 * Root layout — warm-canvas typography (SPEC docs/agents/DESIGN.md).
 *
 * Copernicus (Anthropic's licensed serif) is substituted with Fraunces,
 * an open-source Optical/Cormorant-style variable serif. Body sans is
 * Inter (the documented StyreneB substitute). JetBrains Mono handles
 * code + audit metadata. Next/font self-hosts each family and exposes
 * a stable CSS variable that `globals.css` binds via `--font-*`.
 */
const serifDisplay = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif-display",
  display: "swap",
});
const sansBody = Inter({
  subsets: ["latin"],
  variable: "--font-sans-body",
  display: "swap",
});
const monoCode = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StanzaChat",
  description: "Open-source, self-hosted AI workspace",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${serifDisplay.variable} ${sansBody.variable} ${monoCode.variable}`}
    >
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
