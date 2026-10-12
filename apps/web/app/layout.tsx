import type { Metadata } from "next";
import { NavBar } from "@/components/shell/NavBar";
import { TimeZoneCookie } from "@/components/shell/TimeZoneCookie";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskMaster",
  description: "Turn everything on your mind into a clear, realistic plan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <TimeZoneCookie />
        <NavBar />
        {children}
      </body>
    </html>
  );
}
