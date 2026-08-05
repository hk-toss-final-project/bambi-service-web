"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useNotifications } from "@/hooks/use-notifications";
import { markNotificationRead } from "@/lib/repositories/notifications";
import type { NotificationDto } from "@/types/notification";

/** 완성된 리포트를 보여 주는 헤더 알림 Inbox. */
export function NotificationMenu() {
  const router = useRouter();
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.status === "success" ? notifications.data.unreadCount : 0;

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function openNotification(notification: NotificationDto) {
    if (openingId !== null) return;
    setOpeningId(notification.id);
    try {
      if (!notification.read) await markNotificationRead(notification.id);
    } catch {
      // 읽음 반영 실패가 완성된 리포트 열람까지 막지는 않는다.
    } finally {
      setOpen(false);
      router.push(notification.targetPath);
      notifications.refetch();
      setOpeningId(null);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) notifications.refetch();
        }}
        aria-label={unreadCount > 0 ? `알림 ${unreadCount}개 읽지 않음` : "알림"}
        aria-haspopup="menu"
        aria-expanded={open}
        className="focus-ring relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-border bg-card text-[15px] text-ink-mid hover:bg-background"
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="h-[17px] w-[17px] fill-none stroke-current [stroke-width:1.6]"
        >
          <path d="M8 2c-1.6 0-2.8 1.3-2.8 2.9 0 2.8-1.1 4.1-1.9 4.8h9.4c-.8-.7-1.9-2-1.9-4.8C10.8 3.3 9.6 2 8 2z" strokeLinejoin="round" />
          <path d="M6.6 12.2a1.5 1.5 0 0 0 2.8 0" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex min-h-4 min-w-4 items-center justify-center rounded-full border-2 border-card bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="알림 목록"
          className="absolute right-0 top-[calc(100%+8px)] z-[80] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-border bg-card shadow-[0_16px_40px_rgba(10,12,15,.2)]"
        >
          <div className="flex items-center border-b border-border px-4 py-3">
            <span className="text-[14px] font-bold text-foreground">알림</span>
            {unreadCount > 0 && (
              <span className="ml-2 text-[11px] font-semibold text-signal-ink">새 알림 {unreadCount}</span>
            )}
          </div>
          {notifications.status === "loading" || notifications.status === "idle" ? (
            <p role="status" className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              알림을 불러오는 중…
            </p>
          ) : notifications.status === "error" ? (
            <div className="px-4 py-6 text-center">
              <p className="text-[13px] text-muted-foreground">알림을 불러오지 못했어요.</p>
              <button
                type="button"
                onClick={notifications.refetch}
                className="focus-ring mt-2 rounded-md text-[12px] font-semibold text-signal-ink underline underline-offset-2"
              >
                다시 시도
              </button>
            </div>
          ) : notifications.data.items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              아직 새 알림이 없어요.
            </p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.data.items.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  role="menuitem"
                  disabled={openingId !== null}
                  onClick={() => void openNotification(notification)}
                  className={`focus-ring block w-full border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-background disabled:opacity-60 ${
                    notification.read ? "bg-card" : "bg-wash/50"
                  }`}
                >
                  <span className="flex items-start gap-2">
                    {!notification.read && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-bold text-foreground">
                        {notification.title}
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                        {notification.body}
                      </span>
                      <span className="mt-1 block text-[10.5px] text-muted-foreground">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
