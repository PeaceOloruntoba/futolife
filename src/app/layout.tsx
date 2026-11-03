import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SonnerProvider } from "@/components/sonner-provider";
import { AuthSessionProvider } from "@/components/auth-session-provider";

export const metadata: Metadata = {
  title: "FUTO Life — Explore your campus",
  description: "Explore your campus. Find your people. Make your story.",
  applicationName: "FUTO Life",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  themeColor: "#10120f",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body><AuthSessionProvider>{children}</AuthSessionProvider><SonnerProvider/></body></html>;
}
