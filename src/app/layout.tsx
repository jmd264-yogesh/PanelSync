import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teams Interview Scheduler | Microsoft Graph API Automation",
  description: "Schedule employee panel interviews seamlessly. Dispatch Teams notifications, collect availabilities, calculate overlapping slots, and schedule meetings automatically.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

