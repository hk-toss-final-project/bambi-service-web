import type { Metadata } from "next";

import { ScrapScreen } from "@/components/scrap/scrap-screen";

export const metadata: Metadata = {
  title: "AlphaCatcher — 북마크",
  description: "담아둔 공개 보고서를 다시 확인해요.",
};

/**
 * 북마크(스크랩) — /scraps. member 전용. 라우트 가드 없음(토큰은 localStorage) —
 * 인증 분기·접근 제한은 클라이언트 ScrapScreen 이 담당한다(위키·홈과 동일 패턴).
 */
export default function ScrapsPage() {
  return <ScrapScreen />;
}
