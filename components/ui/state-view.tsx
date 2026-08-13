"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { FALLBACK_ERROR_CODE, resolveErrorMessage, type ErrorCode } from "@/constants/errors";
import { cn } from "@/lib/utils";

/**
 * 상태 화면 액션 — 링크(href) 또는 콜백(onClick) 하나를 준다.
 * disabled 는 문구만 노출하고 동작하지 않는다(예: 라우트 미확정 CTA). 이 경우 href·onClick 없이 둔다.
 */
export type StateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
};

/**
 * 공통 상태 뷰 — 목업 pstate.center(아이콘 · 제목 · 설명 · 액션) 1:1.
 * Loading 이 아닌 "콘텐츠 대신 안내를 보여주는" 자리(Empty / Error / 404 / Preparing)에서 재사용한다.
 * 화면 배치(전체 중앙 정렬 vs 피드 컬럼 내부)는 호출부가 className(너비 · min-height)으로 결정한다.
 */
export function StateView({
  icon,
  iconTone = "neutral",
  title,
  description,
  errorCode,
  actions,
  role,
  className,
  size = "compact",
}: {
  icon?: ReactNode;
  iconTone?: "neutral" | "brand";
  title: string;
  description?: ReactNode;
  /**
   * 서버가 준 오류 코드(있을 때만). 원인이 특정되는 코드면 설명을 `ERROR_MESSAGES` 공통 문구로
   * 대체한다 — 화면마다 권한·AI 장애 문구를 새로 쓰지 않기 위해서다(§4 단일 소스).
   *
   * 일반 오류(INTERNAL_ERROR)와 코드 없음(네트워크 단절)은 **호출부가 준 기존 description 을 그대로**
   * 둔다. 두 경우의 공통 문구가 곧 fallback 이라 덮어써도 정보가 늘지 않고, 화면별로 다듬어 둔
   * 기존 안내만 잃기 때문이다. 서버 error.message 원문은 어느 경로로도 여기 닿지 않는다(§3).
   */
  errorCode?: ErrorCode;
  actions?: StateAction[];
  role?: "status" | "alert";
  className?: string;
  /** compact: 피드 컬럼 내부 안내(기본). page: 화면 전체를 대체하는 페이지 수준 카드(404·접근 제한). */
  size?: "compact" | "page";
}) {
  const isPage = size === "page";
  const body =
    errorCode && errorCode !== FALLBACK_ERROR_CODE ? resolveErrorMessage(errorCode) : description;
  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-[14px] border border-border bg-card text-center",
        isPage ? "rounded-2xl px-8 py-10" : "px-6 py-14",
        className,
      )}
    >
      {icon && (
        <span
          className={cn(
            "mb-1 flex h-11 w-11 items-center justify-center rounded-full border",
            iconTone === "brand"
              ? "border-wash-strong bg-wash text-signal-ink"
              : "border-border bg-background text-muted-foreground",
          )}
        >
          {icon}
        </span>
      )}
      <h2
        className={cn(
          "text-balance font-bold text-foreground",
          isPage ? "text-[22px] tracking-[-0.01em]" : "text-[15px]",
        )}
      >
        {title}
      </h2>
      {body != null && (
        <div
          className={cn(
            "text-pretty leading-[1.7] text-ink-mid",
            isPage ? "max-w-[360px] text-[14px]" : "max-w-[340px] text-[13px]",
          )}
        >
          {body}
        </div>
      )}
      {actions && actions.length > 0 && (
        <div
          className={cn(
            "mt-2",
            isPage ? "flex w-full flex-col gap-2.5" : "flex flex-wrap items-center justify-center gap-2",
          )}
        >
          {actions.map((action) => (
            <StateActionButton key={action.label} action={action} size={size} />
          ))}
        </div>
      )}
    </div>
  );
}

function StateActionButton({
  action,
  size = "compact",
}: {
  action: StateAction;
  size?: "compact" | "page";
}) {
  const cls = cn(
    "focus-ring inline-flex items-center justify-center rounded-[10px] border font-semibold",
    size === "page" ? "h-11 w-full px-4 text-[14px]" : "h-9 px-4 text-[13px]",
    action.variant === "primary"
      ? "border-primary bg-primary text-primary-foreground hover:brightness-[.96]"
      : "border-border bg-card text-ink-mid hover:bg-background",
    action.disabled && "cursor-default opacity-60 hover:bg-card",
  );

  if (action.disabled) {
    return (
      <span aria-disabled="true" className={cls}>
        {action.label}
      </span>
    );
  }
  if (action.href) {
    return (
      <Link href={action.href} className={cls}>
        {action.label}
      </Link>
    );
  }
  if (action.onClick) {
    return (
      <button type="button" onClick={action.onClick} className={cls}>
        {action.label}
      </button>
    );
  }
  return <span className={cls}>{action.label}</span>;
}
