import type { ReactNode } from "react";

export const metadata = {
  title: "StanzaChat",
  description: "Open-source, self-hosted AI workspace",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
