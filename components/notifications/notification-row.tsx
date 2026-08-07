import { cn } from "@/lib/utils";
import { reportTypeLabel } from "@/lib/adapters/notifications";
import type { NotificationVM } from "@/lib/adapters/notifications";

const REPORT_READY_TYPE = "REPORT_READY";
const REPORT_READY_FALLBACK_LABEL = "새 보고서";

/**
 * 알림 행 — 헤더 드롭다운·독립 /notifications 화면이 공유한다.
 * 정보 구조는 "제목 1줄 + 메타(유형 · 시간) 1줄"로 단순화했다 — 본문/요약은 렌더하지 않는다
 * (목록에서는 제목·시각만으로 충분하고, 상세는 클릭해서 본다).
 *
 * 제목은 항상 서버 값 그대로(§7 — 가짜 한국어 타입명 금지). REPORT_READY는 reportType(아침
 * 브리핑/온디맨드)이 있으면 그 라벨을, 없거나 모르는 값이면 일반 "새 보고서"로 표시한다(추측 금지).
 * REPORT_READY 이외의 타입(좋아요·댓글·팔로우 등 소셜 알림 포함)은 현재 백엔드가 내려주지 않으므로
 * 특정 타입 문자열을 임의로 만들지 않고, 아이콘·라벨·화살표 모두 중립 fallback으로 자연스럽게
 * 수용한다 — 백엔드가 실제 타입을 추가하면 이 fallback 경로가 그대로 대응한다.
 *
 * 화살표는 이동 가능한 것으로 확인된 타입(현재는 REPORT_READY 하나)에만 보이는 장식이고, 실제
 * 이동 가능 여부는 클릭 시 resolver(lib/notifications/resolve-notification-target.ts)가 최종 판정한다.
 *
 * variant: "list"(기본) — 헤더 드롭다운의 연속 목록(구분선). "card" — /notifications 목업의
 * 개별 카드형(둥근 모서리·자체 테두리·hover 시 화살표 노출). 두 표면이 같은 행 컴포넌트를
 * 공유하면서도 각자 맥락에 맞는 밀도를 유지한다.
 */
export function NotificationRow({
  notification,
  pending,
  onOpen,
  variant = "list",
}: {
  notification: NotificationVM;
  pending: boolean;
  onOpen: (notification: NotificationVM) => void;
  variant?: "list" | "card";
}) {
  const navigable = notification.type === REPORT_READY_TYPE;
  const unread = !notification.read;
  const isCard = variant === "card";
  const typeLabel = navigable ? reportTypeLabel(notification.reportType) ?? REPORT_READY_FALLBACK_LABEL : null;

  return (
    <li className="list-none">
      <button
        type="button"
        disabled={pending}
        onClick={() => onOpen(notification)}
        className={cn(
          "focus-ring group flex w-full items-start gap-2.5 bg-card text-left disabled:cursor-wait disabled:opacity-60",
          isCard
            ? "rounded-[12px] border border-border px-[15px] py-3 hover:border-wash-strong"
            : "border-b border-border px-4 py-3 last:border-b-0 hover:bg-background",
        )}
      >
        <NotificationTypeIcon type={notification.type} />

        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-1.5">
            {unread && (
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            )}
            {unread && <span className="sr-only">읽지 않음, </span>}
            <span
              className={cn(
                "block text-[13.5px] text-foreground",
                unread ? "font-bold" : "font-medium",
              )}
            >
              {notification.title}
            </span>
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            {typeLabel && <span>{typeLabel}</span>}
            {typeLabel && <span aria-hidden="true">·</span>}
            <span>{notification.timeLabel}</span>
          </span>
        </span>

        {navigable && (
          <span
            aria-hidden="true"
            className={cn(
              "mt-1.5 shrink-0 text-low",
              isCard && "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
            )}
          >
            <ChevronRightIcon />
          </span>
        )}
      </button>
    </li>
  );
}

function NotificationTypeIcon({ type }: { type: string }) {
  if (type === REPORT_READY_TYPE) {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-wash-strong bg-wash text-signal-ink"
      >
        <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5}>
          <rect x="2.2" y="1.8" width="11.6" height="12.4" rx="1.8" />
          <path d="M5 6.4h6M5 9h4" strokeLinecap="round" />
          <path d="M5.4 11.6l1.3 1.3 2.6-2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  // 알 수 없는 타입 — generic bell 아이콘(§7). 가짜 타입명을 만들지 않고 아이콘만 중립으로 대체.
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground"
    >
      <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path
          d="M8 2c-1.6 0-2.8 1.3-2.8 2.9 0 2.8-1.1 4.1-1.9 4.8h9.4c-.8-.7-1.9-2-1.9-4.8C10.8 3.3 9.6 2 8 2z"
          strokeLinejoin="round"
        />
        <path d="M6.6 12.2a1.5 1.5 0 0 0 2.8 0" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M6 3.5l5 4.5-5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
