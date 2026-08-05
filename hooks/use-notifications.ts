"use client";

import { useCallback, useEffect } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { useAsyncData } from "@/hooks/use-async-data";
import { fetchNotifications } from "@/lib/repositories/notifications";
import type { NotificationListDto } from "@/types/notification";

/** 로그인 사용자의 알림 Inbox를 읽고 30초마다 새 완료 알림을 확인한다. */
export function useNotifications() {
  const { status } = useAuth();
  const enabled = status === "authenticated";
  const fetcher = useCallback((signal: AbortSignal) => fetchNotifications(signal), []);
  const state = useAsyncData<NotificationListDto>(fetcher, enabled);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(state.refetch, 30_000);
    return () => window.clearInterval(timer);
  }, [enabled, state.refetch]);

  return state;
}
