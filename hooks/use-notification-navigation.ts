"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { resolveNotificationTarget } from "@/lib/notifications/resolve-notification-target";
import type { NotificationTargetErrorKind } from "@/lib/notifications/resolve-notification-target";
import { markNotificationRead } from "@/lib/repositories/notifications";
import type { NotificationDto } from "@/types/notification";

const TARGET_ERROR_MESSAGE: Record<NotificationTargetErrorKind, string> = {
  "invalid-path": "연결된 보고서를 찾지 못했어요.\n잠시 후 다시 시도해 주세요.",
  "not-found": "연결된 보고서를 찾지 못했어요.\n잠시 후 다시 시도해 주세요.",
  "feed-error": "보고서 정보를 확인하지 못했어요.\n잠시 후 다시 시도해 주세요.",
};

export type NotificationOpenError = { id: number; message: string };

/**
 * 알림 클릭 → 상세 이동 처리(드롭다운·독립 /notifications 화면이 각자 독립 인스턴스로 쓴다).
 *
 * 흐름: 행 pending lock → targetPath 검증 + feed 기반 resolve
 *   → 실패(형식 불량·feed 조회 실패·불일치) 시 이동 0회·PUT 0회·unread 유지, 원인별 문구로 안내
 *   → 성공 시 즉시 상세로 이동(읽음 처리 결과를 기다리지 않는다)
 *   → 이동 후 미읽음이었다면 read PUT 시도 — 성공하면 onReadConfirmed()(호출부의 refetch)로
 *     unread badge·행 상태를 서버 진실에 맞춰 자연스럽게 갱신한다. 실패하면 raw 오류를 노출하지
 *     않고 조용히 종료하되, 로컬 read 를 낙관적으로 바꾸지 않아 unread 를 유지한다(다음 조회가
 *     서버 진실과 다시 맞춘다) — 실패를 삼키는 게 아니라 "성공 경로(refetch)를 타지 않는다"로 구분한다.
 */
export function useNotificationOpen(onReadConfirmed: () => void) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<NotificationOpenError | null>(null);

  const openNotification = useCallback(
    async (notification: NotificationDto): Promise<boolean> => {
      if (pendingId !== null) return false;
      setError(null);
      setPendingId(notification.id);

      const result = await resolveNotificationTarget(notification.targetPath);

      if (!result.ok) {
        setPendingId(null);
        setError({ id: notification.id, message: TARGET_ERROR_MESSAGE[result.error] });
        return false;
      }

      setPendingId(null);
      router.push(`/report/${result.cardPublicId}`);

      if (!notification.read) {
        try {
          await markNotificationRead(notification.id);
          onReadConfirmed();
        } catch {
          // 읽음 반영 실패 — 상세는 이미 유효해 이동은 진행됐다. unread 를 그대로 두고
          // (로컬 낙관적 갱신 없음) 다음 조회에서 서버 진실과 맞춘다.
        }
      }
      return true;
    },
    [pendingId, router, onReadConfirmed],
  );

  return { pendingId, error, openNotification };
}
