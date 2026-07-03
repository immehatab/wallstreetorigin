import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XAU Terminal — Data Foundation",
  description: "AI-powered institutional trading terminal · Module 1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
