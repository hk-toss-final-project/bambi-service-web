"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/components/auth/use-auth";
import { useRequireAuth } from "@/components/auth/use-require-auth";
import { Orb } from "@/components/brand/orb";
import { MOCK_NAV } from "@/lib/mock/feed";

/**
 * 상단 nav — 인증 상태(§15)에 따라 분기.
 * - authenticated: 기존 로그인 헤더(검색 P1·＋관심자료·알림 P1·아바타 드롭다운[이름·이메일·로그아웃])
 * - guest: 검색·알림·아바타 숨김 · ＋관심자료(중립·hover 주황·클릭 시 GuestGateModal) · 로그인 · 가입하기(Primary)
 * - loading·error: 로그인 전용 정보(아바타·내 보고서)와 guest CTA 를 모두 숨긴 중립 헤더(로고만).
 *   인증 확정 전(loading)·확인 실패(error)에 잘못된 상태의 헤더를 노출하지 않는다.
 *
 * onAddOpen: authenticated 에서 관심 자료 추가 모달을 여는 콜백. guest 는 requireAuth 가
 * 가로채 GuestGateModal 을 띄우므로 실행되지 않는다.
 */
export function HomeNav({ onAddOpen }: { onAddOpen: () => void }) {
  const { status } = useAuth();
  const { requireAuth } = useRequireAuth();

  return (
    <nav className="border-b border-border bg-card">
      <div className="relative mx-auto flex h-[58px] max-w-[1440px] items-center gap-[18px] px-6">
        {/* .logo */}
        <div className="flex items-center gap-[9px]">
          <Orb size={26} />
          <span className="text-[17px] font-normal tracking-[.02em] text-foreground [font-family:Quicksand,sans-serif]">
            alphacatcher
          </span>
        </div>
        <div className="flex-1" />

        {status === "authenticated" ? (
          <MemberNavRight onAddOpen={onAddOpen} />
        ) : status === "guest" ? (
          <GuestNavRight onAdd={() => requireAuth(onAddOpen)} />
        ) : null /* loading·error → 중립(로고만) */}
      </div>
    </nav>
  );
}

/** 비로그인(guest·error) 우측: ＋관심자료(중립·게이트) · 로그인 · 가입하기(Primary). */
function GuestNavRight({ onAdd }: { onAdd: () => void }) {
  return (
    <>
      {/* ＋ 관심 자료 — 중립 기본, hover 시 테두리·문자만 주황. 클릭 시 GuestGateModal */}
      <button
        type="button"
        onClick={onAdd}
        className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-ink-mid hover:border-primary hover:text-signal-ink"
      >
        ＋ 관심 자료
      </button>
      {/* 로그인 — 보조 */}
      <Link
        href="/login"
        className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-foreground hover:bg-background"
      >
        로그인
      </Link>
      {/* 가입하기 — Primary */}
      <Link
        href="/signup"
        className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-primary-foreground hover:brightness-[.96]"
      >
        가입하기
      </Link>
    </>
  );
}

/** 로그인 사용자 우측: 검색(P1) · ＋관심자료 · 알림(P1) · 아바타 드롭다운. */
function MemberNavRight({ onAddOpen }: { onAddOpen: () => void }) {
  return (
    <>
      {/* .nav-search — P1(검색), 시각 전용 */}
      <div
        aria-disabled="true"
        className="absolute top-1/2 left-1/2 flex h-[38px] w-[596px] max-w-[calc(100%-380px)] -translate-x-1/2 -translate-y-1/2 items-center gap-[9px] rounded-[19px] border border-border bg-background px-[15px] text-[13px] text-muted-foreground"
      >
        {/* .sico */}
        <span className="relative h-[13px] w-[13px] shrink-0 rounded-full border-[1.5px] border-low after:absolute after:-right-1 after:-bottom-0.5 after:h-[1.5px] after:w-[5px] after:rotate-45 after:bg-low after:content-['']" />
        {MOCK_NAV.searchPlaceholder}
      </div>

      {/* .btn.signal.sm — 관심 자료 추가 모달 (실동작) */}
      <button
        type="button"
        onClick={onAddOpen}
        className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary bg-primary px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-primary-foreground hover:brightness-[.96]"
      >
        ＋ 관심 자료
      </button>

      {/* .nav-ico — 알림, P1 시각 전용 */}
      <button
        type="button"
        aria-disabled="true"
        aria-label="알림"
        title="알림"
        className="focus-ring relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-border bg-card text-[15px] text-ink-mid"
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="h-[17px] w-[17px] fill-none stroke-current [stroke-width:1.6]"
        >
          <path d="M8 2c-1.6 0-2.8 1.3-2.8 2.9 0 2.8-1.1 4.1-1.9 4.8h9.4c-.8-.7-1.9-2-1.9-4.8C10.8 3.3 9.6 2 8 2z" strokeLinejoin="round" />
          <path d="M6.6 12.2a1.5 1.5 0 0 0 2.8 0" strokeLinecap="round" />
        </svg>
        {/* .badge */}
        <span className="absolute top-0.5 right-[3px] h-[7px] w-[7px] rounded-full border-2 border-card bg-primary" />
      </button>

      <AvatarMenu />
    </>
  );
}

/** .nav-avatar + 최소형 드롭다운(이름·이메일·로그아웃). 프로필·설정 등 미구현 메뉴는 추가하지 않는다. */
function AvatarMenu() {
  const { user, logoutUser } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭·Esc 로 닫기
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = user?.displayName?.trim()?.[0] ?? MOCK_NAV.avatarInitial;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="내 계정"
        aria-haspopup="menu"
        aria-expanded={open}
        className="focus-ring flex h-[34px] w-[34px] items-center justify-center rounded-full border border-input bg-background text-[12.5px] font-bold text-ink-mid hover:border-wash-strong"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-[80] w-[220px] rounded-xl border border-border bg-card p-1.5 shadow-[0_16px_40px_rgba(10,12,15,.2)]"
        >
          {/* 사용자 정보 */}
          <div className="px-2.5 py-2">
            <div className="truncate text-[13.5px] font-bold text-foreground">
              {user?.displayName ?? "사용자"}
            </div>
            {user?.email && (
              <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{user.email}</div>
            )}
          </div>
          <div className="my-1 h-px bg-border" />
          {/* 로그아웃 — 토큰 제거 후 guest 전환. 네비게이션하지 않아 현재 공개 화면 유지 */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logoutUser();
            }}
            className="focus-ring w-full rounded-lg px-2.5 py-2 text-left text-[13.5px] font-semibold text-foreground hover:bg-background"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
