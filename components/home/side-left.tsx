"use client";

import Link from "next/link";

import { useRequireAuth } from "@/components/auth/use-require-auth";
import { MOCK_MENU, MOCK_MENU_BOTTOM } from "@/lib/mock/feed";

/**
 * 좌측 메뉴 — 목업 .side-l. 홈·카드 상세가 공유한다.
 *
 * - member(기본): 텍스트 메뉴. 홈 외 항목은 P1 화면 → 시각 전용(aria-disabled).
 * - guest: 아이콘 전용 내비(§15). member 와 동일 순서·아이콘, 카운트 숨김.
 *   홈만 실제 이동, 나머지는 클릭 시 GuestGateModal.
 * "홈"은 현재 화면이 아니면 실제 링크(/)로 동작한다.
 */
export function SideLeft({
  current,
  footLines,
  guest = false,
}: {
  /** 현재 화면의 메뉴 라벨 (예: "홈"). 해당 항목이 .on 처리된다. */
  current?: string;
  /** .side-foot 줄 목록 (member 전용) */
  footLines: string[];
  /** true 면 아이콘 전용 guest 내비로 렌더한다. */
  guest?: boolean;
}) {
  if (guest) return <GuestNav current={current} />;

  return (
    <aside className="sticky top-4 w-[300px] shrink-0 max-[1100px]:hidden">
      {/* .menu */}
      <div className="rounded-[14px] border border-border bg-card p-2">
        {MOCK_MENU.map((item) => (
          <MenuItem key={item.label} {...item} active={item.label === current} />
        ))}
        {/* .divider */}
        <div className="mx-1.5 my-[7px] h-px bg-border" />
        {MOCK_MENU_BOTTOM.map((item) => (
          <MenuItem key={item.label} {...item} active={item.label === current} />
        ))}
      </div>
      {/* .side-foot */}
      <div className="mt-3 px-1.5 text-[11.5px] leading-[1.6] text-muted-foreground">
        {footLines.map((line, i) => (
          <span key={line}>
            {line}
            {i < footLines.length - 1 && <br />}
          </span>
        ))}
      </div>
    </aside>
  );
}

/** 비로그인 아이콘 전용 내비 — member 순서(홈·보관함·지식창고·관심사·프로필·구분선·설정), 카운트 숨김. */
function GuestNav({ current }: { current?: string }) {
  const { requireAuth } = useRequireAuth();
  return (
    <aside className="sticky top-4 w-[300px] shrink-0 max-[1100px]:hidden">
      <div className="flex w-12 flex-col gap-2">
        {MOCK_MENU.map((item) => (
          <GuestNavIcon
            key={item.label}
            icon={item.icon}
            label={item.label}
            active={item.label === current}
            onGate={() => requireAuth(() => {})}
          />
        ))}
        <div className="mx-auto my-1 h-px w-6 bg-border" aria-hidden="true" />
        {MOCK_MENU_BOTTOM.map((item) => (
          <GuestNavIcon
            key={item.label}
            icon={item.icon}
            label={item.label}
            active={item.label === current}
            onGate={() => requireAuth(() => {})}
          />
        ))}
      </div>
    </aside>
  );
}

/** guest 아이콘 항목 — 홈만 실제 이동(/), 나머지는 클릭 시 GuestGateModal. */
function GuestNavIcon({
  icon,
  label,
  active,
  onGate,
}: {
  icon: string;
  label: string;
  active: boolean;
  onGate: () => void;
}) {
  const base = "focus-ring flex h-12 w-12 items-center justify-center rounded-[14px] text-[21px]";
  if (label === "홈") {
    if (active) {
      return (
        <span
          aria-current="page"
          aria-label={label}
          title={label}
          className={`${base} bg-wash text-signal-ink`}
        >
          {icon}
        </span>
      );
    }
    return (
      <Link href="/" aria-label={label} title={label} className={`${base} text-ink-mid hover:bg-background hover:text-foreground`}>
        {icon}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onGate}
      aria-label={label}
      title={`${label} — 로그인 후 이용할 수 있어요`}
      className={`${base} text-ink-mid hover:bg-background hover:text-foreground`}
    >
      {icon}
    </button>
  );
}

function MenuItem({
  icon,
  label,
  count,
  active,
}: {
  icon: string;
  label: string;
  count?: string;
  active: boolean;
}) {
  const base =
    "focus-ring mb-px flex w-full items-center gap-3 rounded-[10px] px-3 py-[11px] text-left text-[14.5px]";
  if (active) {
    // .mi.on — 현재 화면
    return (
      <div aria-current="page" className={`${base} bg-background font-bold text-foreground`}>
        <span className="inline-flex w-5 shrink-0 items-center justify-center text-[15px] text-primary">
          {icon}
        </span>
        {label}
        {count && <span className="ml-auto text-[11.5px] text-muted-foreground">{count}</span>}
      </div>
    );
  }
  if (label === "홈") {
    // 다른 화면(카드 상세 등)에서는 홈으로 실제 이동
    return (
      <Link href="/" className={`${base} text-ink-mid hover:bg-background`}>
        <span className="inline-flex w-5 shrink-0 items-center justify-center text-[15px] text-muted-foreground">
          {icon}
        </span>
        {label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-disabled="true"
      className={`${base} text-ink-mid hover:bg-background`}
    >
      <span className="inline-flex w-5 shrink-0 items-center justify-center text-[15px] text-muted-foreground">
        {icon}
      </span>
      {label}
      {count && <span className="ml-auto text-[11.5px] text-muted-foreground">{count}</span>}
    </button>
  );
}
