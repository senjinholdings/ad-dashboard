import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { ReportDateRangeProvider } from "@/contexts/ReportDateRangeContext";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "広告運用ダッシュボード",
  description: "週次報告・パフォーマンス分析ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${manrope.variable} antialiased font-sans`}>
        <ReportDateRangeProvider>
          {children}
        </ReportDateRangeProvider>
      </body>
    </html>
  );
}
