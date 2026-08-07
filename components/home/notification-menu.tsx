"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NotificationRow } from "@/components/notifications/notification-row";
import { useNotificationOpen } from "@/hooks/use-notification-navigation";
import { useNotifications } from "@/hooks/use-notifications";
import { toNotificationVM } from "@/lib/adapters/notifications";
import type { NotificationDto } from "@/types/notification";

const NOTIFICATIONS_PAGE_PATH = "/notifications";

/**
 * 헤더 알림 진입점 — 대부분의 화면에서는 드롭다운, `/notifications` 화면에서는 현재 화면 링크로만
 * 렌더한다(본문이 이미 같은 데이터를 30초 polling하므로 드롭다운 훅을 중복 mount하지 않는다).
 * 두 갈래를 별도 컴포넌트로 분리해 각자 자기 Hooks만 무조건 호출한다(Hooks 규칙 준수).
 */
export function NotificationMenu() {
  const pathname = usePathname();
  if (pathname === NOTIFICATIONS_PAGE_PATH) return <NotificationBellLink />;
  return <NotificationDropdown />;
}

/** `/notifications` 화면 전용 — 배지·polling 없이 "현재 화면" 상태만 보여준다. */
function NotificationBellLink() {
  return (
    <Link
      href={NOTIFICATIONS_PAGE_PATH}
      aria-current="page"
      aria-label="알림"
      className="focus-ring relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-primary bg-wash text-signal-ink"
    >
      <BellIcon />
    </Link>
  );
}

/**
 * 완성된 리포트를 보여 주는 헤더 알림 Inbox.
 * 완전한 ARIA menu 키보드 패턴(방향키 탐색 등)은 구현하지 않으므로 role="menu"/"menuitem" 대신
 * 일반 popover(목록 + button) 의미로 둔다. Esc로 닫을 때만 트리거로 포커스를 되돌리고,
 * 바깥 클릭으로 닫을 때는 클릭한 대상이 포커스를 자연스럽게 가져가도록 그대로 둔다.
 */
function NotificationDropdown() {
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const unreadCount = notifications.status === "success" ? notifications.data.unreadCount : 0;
  const { pendingId, error, openNotification } = useNotificationOpen(notifications.refetch);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleOpen(notification: NotificationDto) {
    const navigated = await openNotification(notification);
    if (navigated) setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) notifications.refetch();
        }}
        aria-label={unreadCount > 0 ? `알림 ${unreadCount}개 읽지 않음` : "알림"}
        aria-haspopup="true"
        aria-expanded={open}
        className="focus-ring relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-border bg-card text-[15px] text-ink-mid hover:bg-background"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex min-h-4 min-w-4 items-center justify-center rounded-full border-2 border-card bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          aria-label="알림 목록"
          className="absolute right-0 top-[calc(100%+8px)] z-[80] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-border bg-card shadow-[0_16px_40px_rgba(10,12,15,.2)]"
        >
          <div className="flex items-center border-b border-border px-4 py-3">
            <span className="text-[14px] font-bold text-foreground">알림</span>
            {unreadCount > 0 && (
              <span className="ml-2 text-[11px] font-semibold text-signal-ink">새 알림 {unreadCount}</span>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="border-b border-border bg-wash px-4 py-2 text-[12px] whitespace-pre-line text-signal-ink"
            >
              {error.message}
            </p>
          )}

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
            <ul className="max-h-[420px] overflow-y-auto">
              {notifications.data.items.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={toNotificationVM(notification)}
                  pending={pendingId === notification.id}
                  onOpen={handleOpen}
                />
              ))}
            </ul>
          )}

          <Link
            href={NOTIFICATIONS_PAGE_PATH}
            onClick={() => setOpen(false)}
            className="focus-ring block border-t border-border px-4 py-2.5 text-center text-[12.5px] font-semibold text-signal-ink hover:bg-background"
          >
            전체 알림 보기
          </Link>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-[17px] w-[17px] fill-none stroke-current [stroke-width:1.6]"
    >
      <path
        d="M8 2c-1.6 0-2.8 1.3-2.8 2.9 0 2.8-1.1 4.1-1.9 4.8h9.4c-.8-.7-1.9-2-1.9-4.8C10.8 3.3 9.6 2 8 2z"
        strokeLinejoin="round"
      />
      <path d="M6.6 12.2a1.5 1.5 0 0 0 2.8 0" strokeLinecap="round" />
    </svg>
  );
}
