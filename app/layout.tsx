import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeProvider from "@/components/ThemeProvider";
import { AIConfigProvider } from "@/context/AIConfigContext";
import { DeckProvider } from "@/context/DeckContext";
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
  title: "ExamFlash | 闪卡速记与自测",
  description: "轻量级备考闪卡与自测工具：导入知识卡片、翻转记忆、检验掌握度。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <DeckProvider>
            <AIConfigProvider>{children}</AIConfigProvider>
          </DeckProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
