import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

export const metadata = {
  title: "Close With Casey | Walkaway Calculator",
  description:
    "Estimate what you could walk away with after selling your home in Fort Wayne and surrounding areas.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Close With Casey | Walkaway Calculator",
    description:
      "Get a quick net proceeds range (walkaway money) from selling your home.",
    type: "website",
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
