import type { Metadata } from "next";

import { NotificationsScreen } from "@/components/notifications/notifications-screen";

export const metadata: Metadata = {
  title: "AlphaCatcher — 알림",
  description: "새 보고서와 중요한 업데이트를 모아 봅니다.",
};

/**
 * 알림 전체 보기 — /notifications. member 전용. 라우트 가드 없음(토큰은 localStorage) —
 * 인증 분기·접근 제한은 클라이언트 NotificationsScreen이 담당한다(설정·홈·내 보고서와 동일 패턴).
 */
export default function NotificationsPage() {
  return <NotificationsScreen />;
}
