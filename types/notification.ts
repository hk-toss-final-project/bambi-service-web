import type { ReportType } from "@/types/report";

/**
 * 리포트 발행 완료 알림 Inbox API 타입.
 *
 * reportType: 보고서 생성 종류 — **현재 백엔드 응답에는 이 필드가 없다**(service-api
 * `NotificationResponse`·`Notification` 엔티티 실측, 2026-08-06). 백엔드가 추가하면 즉시
 * 쓰이도록 optional 로 미리 선언해 두되, 값이 없거나 알 수 없으면 추측하지 않고 일반 라벨로
 * 대체한다(lib/adapters/notifications.ts 의 reportTypeLabel → lib/report-type.ts).
 *
 * 타입은 계약값(ReportType)으로 좁혀 두지만 런타임 판정은 문자열 무엇이 오든 안전하다
 * (매핑 함수가 unknown 을 받아 검증한다). 알림 목록에 종류 배지를 붙이는 것은 이번 범위가 아니다.
 */
export type NotificationDto = {
  id: number;
  type: string;
  title: string;
  body: string;
  targetPath: string;
  read: boolean;
  createdAt: string;
  reportType?: ReportType | null;
};

export type NotificationListDto = {
  unreadCount: number;
  items: NotificationDto[];
};
