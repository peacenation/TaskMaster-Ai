import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NavBar } from "@/components/shell/NavBar";
import { ServiceWorker } from "@/components/shell/ServiceWorker";
import { TimeZoneCookie } from "@/components/shell/TimeZoneCookie";
import "./globals.css";

// Self-hosted at build time, so CSP font-src 'self' still holds.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "TaskMaster",
  description: "Turn everything on your mind into a clear, realistic plan.",
  applicationName: "TaskMaster",
  appleWebApp: { capable: true, title: "TaskMaster", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#1a120e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <TimeZoneCookie />
        <ServiceWorker />
        <NavBar>{children}</NavBar>
      </body>
    </html>
  );
}
