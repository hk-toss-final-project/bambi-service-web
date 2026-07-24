import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AuthProvider } from "@/components/auth/auth-provider";
import { GuestGateProvider } from "@/components/auth/guest-gate-provider";

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
  title: "AlphaCatcher — 밤새비서",
  description: "매일 아침, 나에게 중요한 것만. 관심사 기반 출처 카드 브리핑.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 앱 셸 — 모달이 열리면 이 요소를 inert + aria-hidden 처리해 배경(키보드·스크린리더)을 격리한다.
            모달은 createPortal 로 이 요소 바깥(document.body)에 렌더되어 자신은 inert 되지 않는다. */}
        <div id="app-shell" className="flex min-h-full flex-1 flex-col">
          <AuthProvider>
            <GuestGateProvider>{children}</GuestGateProvider>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
