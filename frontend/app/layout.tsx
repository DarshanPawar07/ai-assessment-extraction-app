import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Assessment Extraction",
  description: "AI-powered question and answer assessment system",
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