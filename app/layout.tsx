import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./product.css";

export const metadata: Metadata = {
  title: "AI Pulse",
  description: "AI updates, original-source news, and evidence-backed tools for your next project.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "AI Pulse", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1413" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
