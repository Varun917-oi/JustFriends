import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { VideoBackground } from "@/components/video-background";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Our Little Universe",
  description: "Some moments pass. Some become a part of us.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <VideoBackground />
        <div className="page-content">{children}</div>
      </body>
    </html>
  );
}
