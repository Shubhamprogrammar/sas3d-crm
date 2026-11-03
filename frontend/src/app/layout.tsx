import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers, THEME_SCRIPT } from "@/components/layout/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SAS3D CRM", template: "%s | SAS3D CRM" },
  description: "SAS3D internal CRM and business management system",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
