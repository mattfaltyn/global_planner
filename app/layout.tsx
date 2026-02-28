import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const uiFont = localFont({
  src: "../public/fonts/SFNS.ttf",
  variable: "--font-ui",
  display: "swap",
});

const displayFont = localFont({
  src: "../public/fonts/NewYork.ttf",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Global Planner",
  description: "Interactive flight globe for major airports and direct routes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${uiFont.variable} ${displayFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
