import type { Metadata } from "next";
import { Suspense } from "react";

import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { HomeScreen } from "@/components/home/home-screen";

export const metadata: Metadata = {
  title: "AlphaCatcher — 홈",
  description: "관심사 기반 카드 브리핑 피드.",
};

/**
 * 홈(P0-3) — [내 보고서]/[피드] 탭 전환.
 * 라우트 가드 없음(확정): 공개 화면 — 토큰 유무와 무관하게 열람 가능 (CLAUDE.md §5·§15 2026-07-21).
 * guest 최소 UI(비로그인 헤더·피드 단일 탭·가입 유도 모달 #guest-modal)는 P0 —
 * 인증 상태 계층(AuthProvider)과 함께 구현 예정. 목업: variants/home-feed-guest.html.
 */
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto min-h-screen max-w-[760px] px-5 py-8" aria-hidden="true">
          <FeedSkeleton />
        </main>
      }
    >
      <HomeScreen />
    </Suspense>
  );
}
