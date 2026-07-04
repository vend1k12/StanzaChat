import "./globals.css";

import type { ReactNode } from "react";

import { Providers } from "@/components/providers";

export const metadata = {
  title: "StanzaChat",
  description: "Open-source, self-hosted AI workspace",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
